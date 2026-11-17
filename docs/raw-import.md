# Three-tab raw import

The owner-private admin at `/admin.html` accepts `.xlsx` files up to 15 MB. Download `/upload-template.xlsx` for exact headers. Existing analysis-sheet uploads remain supported.

- 電子便利貼(全), A:H: 填表日期、填表人、幫忙的人、部門、被幫忙的人、事件說明、區間、加分。
- 紙本便利貼, A:F: 組別、姓名、內容、加成、週期、署名。
- 員工名單, A:D: 部門、姓名、組別、新進離職。

Rows are individual notes. Base votes = one per row; weighted votes = base plus nonnegative integer bonus. Empty note text still earns a base vote. Featured quotes require both positive bonus and nonempty text. Electronic B and paper F each contribute one signature to a known employee. Existing manager names are retained; signatures are recomputed from that list.

The user explicitly selected monthly cumulative replacement. Admin month checkboxes determine which months are replaced in BOTH sources. Other months survive unchanged. Reuploading the same month never appends votes. Duplicate-looking rows are retained and flagged, because two genuine notes may have identical content. Missing recipients or conflicting electronic departments block the upload. New employees must be supplied in the roster delta. Missing/unknown senders are flagged without discarding the recipient's vote.

Master employees are keyed by exact trimmed name. Blank delta status preserves the current status; new rows default to 在職. 新進/到職/在職/復職 set 在職; 離職 marks departed without deleting historical cohorts or votes. Omitted employees remain. Initial statuses are 未註記. New hires join touched quarterly cohorts; roster-only new hires join the latest quarter with zero votes. Historical quarter departments are preserved. Quarterly headcounts include historical/zero-vote people and must not be labeled current headcount.

The supported year/month range is 2026 July–December. Periods must be individual months; electronic dates must agree with the month. No automatic month/year guessing from the current date.

The server independently validates and calculates raw payloads for preview and commit. Updates use expected revision plus conditional R2 pointer writes. Originals, full snapshots including roster, and immutable history are retained. Restore creates a new revision of both quarter data and roster. The first seed includes exact monthly signatures derived from original workbooks with original exact-name matching. Legacy snapshots recover this ledger only when original financial and signature data match; otherwise a full-quarter first raw upload is required to avoid inventing monthly signatures.

Run `node scripts/build.mjs` then `node --test tests/*.test.mjs`. Local preview uses a separate `.local/r2` store; production R2 data is never seeded by tests. Build assets are precompressed and Worker responses use `encodeBody: manual`.
