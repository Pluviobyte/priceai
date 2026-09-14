# Category icons

Marks for the catalogue categories that have no brand behind them.

- `mail.svg`, `verification.svg`, `other.svg` — original neutral glyphs, not brand marks.

These three categories deliberately carry no official logo. 邮箱 spans Outlook, Gmail and
iCloud listings at once, so putting any one vendor's mark on it would misrepresent the
other two; 接码 and 其他 are service kinds rather than products of any company. The four
brand categories (ChatGPT, Claude, Gemini, Grok) use the official marks in
`../model-icons/` instead.

Each file carries a `prefers-color-scheme` rule: they are loaded through `<img>` and so
cannot inherit the page's text colour.
