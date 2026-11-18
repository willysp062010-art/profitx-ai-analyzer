import concurrent.futures as cf
import json
import re
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timezone

RPC = "https://api.mainnet-beta.solana.com"
PROGRAMS = {
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "SPL Token",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb": "Token-2022",
}
MINT = re.compile(r"[1-9A-HJ-NP-Za-km-z]{32,44}")

def collect(slot):
    try:
        params = [slot, dict(encoding="jsonParsed", commitment="finalized",
                            transactionDetails="full", rewards=False, maxSupportedTransactionVersion=1)]
        request = urllib.request.Request(RPC, data=json.dumps(dict(jsonrpc="2.0",id=1,method="getBlock",params=params)).encode(),
                                         headers={"Content-Type":"application/json"})
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.load(response)
        if result.get("error") or not isinstance(result.get("result"), dict):
            raise ValueError(str(result.get("error","missing block")))
        block = result["result"]
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
        return dict(slot=slot, transactions=len(block["transactions"]), unknown_token_instructions_or_transactions=unavailable, creations=rows)
    except Exception as error:
        return dict(slot=slot,error=str(error))

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


if __name__ == "__main__":
    anchor = int(sys.argv[1])
    index_url = sys.argv[2]
    slots = [anchor - offset for offset in range(40, 2000, 83)]
    with cf.ThreadPoolExecutor(max_workers=3) as pool:
        blocks = list(pool.map(collect, slots))
    comparisons = compare_index(blocks, index_url)
    json.dump({
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "anchor_slot": anchor,
        "blocks": blocks,
        "comparisons": comparisons
    }, sys.stdout, indent=2)
