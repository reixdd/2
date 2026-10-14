# V6.1 Windows EPERM local-storage repair

The original V6 local file store used a synchronous `renameSync('dit-store.json.tmp', 'dit-store.json')` after every memory or vote change. On Windows, a short antivirus/indexer lock can make this throw `EPERM` and terminate the entire Node process.

## Fixed in V6.1

- One serialized asynchronous writer writes to a PID-specific temporary file, then replaces the committed database in place.
- Bounded retries for transient Windows `EPERM`, `EACCES`, `EBUSY`, `ENOTEMPTY`, and `EEXIST` rename failures.
- Background save failures are logged and retried instead of crashing the research server. The existing committed database is never deleted before a successful replacement.
- Interrupted temporary snapshots from V6 (`dit-store.json.tmp`) or newer PID-suffixed saves are recovered when valid and newer than the committed file. Incomplete JSON is ignored. No historical records are intentionally cleared.
- Startup and Ctrl+C await pending writes; failed final saves are reported.
- Four regression tests cover transient EPERM, interrupted-write recovery, invalid temporary writes, and rapid concurrent mutations.

## Upgrade without losing research

1. Stop DIT (Ctrl+C), and close any second DIT server window using the same data folder.
2. Back up your old `proj/.data/` folder before making changes, and keep any `*.tmp` files inside it.
3. Extract this ZIP and copy its updated source files over the old `proj/`, **or** run the new extracted project after copying the previous `.data/` folder into its `proj/` directory. Keep your existing `.env` if you made one.
4. Run `START-DIT-WINDOWS.cmd`. If recovery detects an interrupted save it will log `[storage] Recovering newer valid local snapshot ...`.

If you still see persistent Windows permission errors, move the extracted project to a normal writable path outside protected folders, such as `C:\DIT\`, and make sure Windows Defender Controlled Folder Access or sync/backup tools are not blocking changes. Do not delete `.data/dit-store.json`.

## Ollama / JARVIS setup (independent from EPERM)

An `[llm] ... "lastError":"fetch failed"` log means the configured model service did not answer at `127.0.0.1:11434`. It is not a storage failure. In PowerShell, run `ollama list` to check installed models and launch the Ollama application or `ollama serve` if needed. You can instead open `http://127.0.0.1:4173/operator`, choose JARVIS, provide the **currently running** JARVIS URL, and use Test & Discover Models. For JARVIS, verify its `/api/status` endpoint responds at that port. Both services are local; the ZIP cannot start them for you.

Model discovery or live inference was **not** tested against the owner's PC. The local research worker can continue collecting observations even when the model isn't configured; original concept generation will be skipped.
