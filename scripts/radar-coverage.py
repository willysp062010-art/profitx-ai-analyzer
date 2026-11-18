import argparse
import copy
import concurrent.futures as cf
import os
import fcntl
import gzip
import json
import re
import sys
import tempfile
import time
import urllib.error
from pathlib import Path
import urllib.request
import urllib.parse
from datetime import datetime, timezone

RPC = os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
PROGRAMS = {
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "SPL Token",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb": "Token-2022",
}
MINT = re.compile(r"[1-9A-HJ-NP-Za-km-z]{32,44}")

def rpc(method, params):
    request = urllib.request.Request(
        RPC, data=json.dumps(dict(jsonrpc="2.0", id=1, method=method, params=params)).encode(),
        headers={"Content-Type": "application/json", "Accept-Encoding": "gzip"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.headers.get("Content-Encoding", "").lower() == "gzip":
            with gzip.GzipFile(fileobj=response) as decoded:
                payload = json.load(decoded)
        else:
            payload = json.load(response)
    if payload.get("error") or "result" not in payload:
        raise ValueError(f"{method} failed")
    return payload["result"]


def collect(slot):
    try:
        block = rpc("getBlock", [slot, dict(
            encoding="jsonParsed", commitment="finalized", transactionDetails="full",
            rewards=False, maxSupportedTransactionVersion=1,
        )])
        if not isinstance(block, dict):
            raise ValueError("Finalized block unavailable")
        rows = []
        unavailable = 0
        for tx in block["transactions"]:
            meta = tx.get("meta")
            if meta is None:
                unavailable += 1
                continue
            if meta.get("err") is not None:
                continue
            events = tx["transaction"]["message"]["instructions"]
            events = events + [i for group in (meta.get("innerInstructions") or []) for i in group["instructions"]]
            for event in events:
                parsed = event.get("parsed")
                if event.get("programId") not in PROGRAMS:
                    continue
                if not isinstance(parsed, dict):
                    unavailable += 1
                    continue
                if parsed.get("type") not in ("initializeMint", "initializeMint2"):
                    continue
                mint = parsed.get("info",{}).get("mint","")
                if not MINT.fullmatch(mint):
                    unavailable += 1
                    continue
                rows.append(dict(mint=mint, signature=tx["transaction"]["signatures"][0],
                                 program=PROGRAMS[event["programId"]], slot=slot, block_time=block["blockTime"]))
        return dict(slot=slot, parent_slot=block["parentSlot"], transactions=len(block["transactions"]), unknown_token_instructions_or_transactions=unavailable, creations=rows)
    except Exception as error:
        return dict(slot=slot,error=type(error).__name__)

def compare_index(blocks, index_url):
    sample = {row["mint"]: row for block in blocks for row in block.get("creations", [])}
    mints = sorted(sample)
    results = []
    for offset in range(0, len(mints), 50):
        batch = mints[offset:offset + 50]
        params = urllib.parse.urlencode({"mints": ",".join(batch)})
        try:
            with urllib.request.urlopen(index_url + "?" + params, timeout=12) as response:
                data = json.load(response)
            indexed = {row["mint"]: row for row in data["results"]}
            if set(indexed) != set(batch):
                raise ValueError("Incomplete index response")
            for mint in batch:
                row = indexed[mint]
                block_time = sample[mint]["block_time"]
                delay = None
                if row["indexed"] and block_time:
                    delta = datetime.fromisoformat(row["detectedAt"]).timestamp() - block_time
                    if delta >= 0:
                        delay = delta
                results.append({**sample[mint], **row, "index_checked_at": data["checkedAt"], "delay_seconds": delay})
        except Exception as error:
            results.extend({**sample[mint], "indexed": None, "error": str(error)} for mint in batch)
    return results


def reconcile(blocks):
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_SECRET_KEY"]
    now = datetime.now(timezone.utc).isoformat()
    unique = {}
    for block in blocks:
        for row in block["creations"]:
            unique.setdefault(row["mint"], row)
    rows = [
        dict(chain_id="solana", mint=row["mint"], source="solana_rpc",
             creation_signature=row["signature"], detected_at=now, last_seen_at=now,
             created_onchain_at=datetime.fromtimestamp(row["block_time"], timezone.utc).isoformat(),
             analysis_status="pending", metadata=dict(
                 slot=row["slot"], verified_creation=True, token_program=row["program"],
                 classification="solana_mint_initialized", ingestion="coverage_backfill",
             ))
        for row in unique.values()
    ]
    inserted = 0
    for offset in range(0, len(rows), 100):
        request = urllib.request.Request(
            f"{url}/rest/v1/pfx_radar_tokens?on_conflict=chain_id,mint&select=mint",
            data=json.dumps(rows[offset:offset + 100]).encode(),
            headers={"Content-Type": "application/json", "apikey": key,
                     "Authorization": f"Bearer {key}",
                     "Prefer": "resolution=ignore-duplicates,return=representation"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            inserted += len(json.load(response))
    return inserted


def save_checkpoint(path, anchor, index_url):
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        try:
            json.dump({"verified_through": anchor, "index_url": index_url}, handle)
            handle.flush()
            os.fsync(handle.fileno())
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)


def parse_anchor(value):
    if value == "finalized":
        return None
    return int(value)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("anchor", type=parse_anchor, help="End slot, sample anchor, or finalized")
    parser.add_argument("index_url")
    parser.add_argument("--start", type=int, help="Start slot for a contiguous range")
    parser.add_argument("--workers", type=int, choices=range(1, 25), default=3)
    parser.add_argument("--repair", action="store_true", help="Insert verified mints with Supabase credentials")
    parser.add_argument("--checkpoint", type=Path, help="Resume verified repair ranges from this file")
    parser.add_argument("--batch-size", type=int, metavar="SLOTS",
                        help="Process successive ranges of 1 to 500 slots through the anchor")
    args = parser.parse_args()
    if args.anchor is None and args.batch_size is None:
        parser.error("The finalized anchor requires --batch-size and --checkpoint")
    if args.batch_size is not None and (not args.checkpoint or not 1 <= args.batch_size <= 500):
        parser.error("--batch-size requires --checkpoint and a size of 1 to 500")
    if args.checkpoint is None:
        return scan(args, parser)
    if not args.repair:
        parser.error("--checkpoint requires --repair")
    lock_path = args.checkpoint.with_name(args.checkpoint.name + ".lock")
    with lock_path.open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            parser.error("Another repair is using this checkpoint")
        if args.checkpoint.exists():
            state = json.loads(args.checkpoint.read_text())
            verified_through = state.get("verified_through")
            if type(verified_through) is not int or verified_through < 0 or state.get("index_url") != args.index_url:
                parser.error("Invalid checkpoint or index URL mismatch")
            if args.start is not None and args.start != verified_through + 1:
                parser.error("--start must immediately follow the checkpoint")
            args.start = verified_through + 1
        if args.batch_size is not None:
            return catch_up(args, parser)
        return scan(args, parser)


def catch_up(args, parser):
    if args.start is None or args.start < 0:
        parser.error("The first catch-up requires a non-negative --start")
    # Freeze the target for this invocation so a scheduled run can exit
    # even if more slots finalize while it is processing the backlog.
    target = args.anchor
    if target is None:
        target = rpc("getSlot", [{"commitment": "finalized"}])
        if type(target) is not int or target < 0:
            raise ValueError("Invalid finalized Solana slot")
        print(json.dumps({"finalized_target": target, "next_slot": args.start}), flush=True)

    batch = copy.copy(args)
    while batch.start <= target:
        batch.anchor = min(batch.start + args.batch_size - 1, target)
        for attempt in range(3):
            try:
                result = scan(batch, parser, compact=True)
            except urllib.error.HTTPError as error:
                if error.code not in (408, 429, 500, 502, 503, 504):
                    raise
                result = 1
            except (urllib.error.URLError, TimeoutError):
                result = 1
            if result == 0:
                break
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
        else:
            print(f"Could not verify slots {batch.start}–{batch.anchor}", file=sys.stderr)
            return 1
        batch.start = batch.anchor + 1
    return 0


def scan(args, parser, compact=False):

    if args.start is None:
        if args.repair:
            parser.error("--repair requires a contiguous range with --start")
        slots = [args.anchor - offset for offset in range(40, 2000, 83)]
    else:
        if not 0 <= args.anchor - args.start < 500:
            parser.error("A contiguous range must contain between 1 and 500 slots")
        finalized = rpc("getSlot", [{"commitment": "finalized"}])
        if args.anchor > finalized:
            parser.error("The end slot must be finalized")
        slots = rpc("getBlocks", [args.start, args.anchor, {"commitment": "finalized"}])
        if (not slots or slots != sorted(set(slots))
                or any(not args.start <= slot <= args.anchor for slot in slots)):
            parser.error("RPC returned an invalid finalized block list")

    with cf.ThreadPoolExecutor(max_workers=args.workers) as pool:
        blocks = list(pool.map(collect, slots))
    incomplete = any("error" in block or block["unknown_token_instructions_or_transactions"] for block in blocks)
    if args.start is not None and not incomplete:
        expected_parent = blocks[0]["parent_slot"]
        if not isinstance(expected_parent, int) or expected_parent >= args.start:
            incomplete = True
        for block in blocks:
            if block["parent_slot"] != expected_parent:
                incomplete = True
            expected_parent = block["slot"]
        if slots[-1] < args.anchor:
            # Prove the trailing slots were skipped by checking the next block's parent.
            following = rpc("getBlocksWithLimit", [args.anchor + 1, 1, {"commitment": "finalized"}])
            if not following or collect(following[0]).get("parent_slot") != slots[-1]:
                incomplete = True
    report = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "anchor_slot": args.anchor,
        "start_slot": args.start,
        "blocks": blocks,
        "incomplete": incomplete,
    }
    if args.repair and not incomplete:
        report["inserted"] = reconcile(blocks)
    report["comparisons"] = compare_index(blocks, args.index_url)
    if compact:
        print(json.dumps({
            "start_slot": args.start,
            "end_slot": args.anchor,
            "blocks": len(blocks),
            "incomplete": incomplete,
            "inserted": report.get("inserted"),
            "creations": len(report["comparisons"]),
            "indexed": sum(row["indexed"] is True for row in report["comparisons"]),
        }), flush=True)
    else:
        json.dump(report, sys.stdout, indent=2)
    if incomplete or any(row["indexed"] is not True for row in report["comparisons"]):
        return 1
    if args.checkpoint is not None:
        save_checkpoint(args.checkpoint, args.anchor, args.index_url)
    return 0


if __name__ == "__main__":
    sys.exit(main())
