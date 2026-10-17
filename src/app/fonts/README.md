# Local web fonts

These unchanged WOFF2 files are checked into the repository so production builds
do not need to contact Google Fonts. They are served and optimized by
`next/font/local` in `src/app/layout.tsx`.

Downloaded on 2026-10-17 from the official Google Fonts CSS service, using the
same families as the previous `next/font/google` configuration:

- [Cormorant Garamond CSS](https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap)
- [DM Sans CSS](https://fonts.googleapis.com/css2?family=DM+Sans:wght@100..1000&display=swap)

| File | Official source | Weight axis | Style | Bytes |
| --- | --- | --- | --- | --- |
| `cormorant-garamond-latin-normal.woff2` | [Google Fonts v21](https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtKky2F7g.woff2) | 300–700 (used at 400–700) | Normal | 37,776 |
| `cormorant-garamond-latin-italic.woff2` | [Google Fonts v21](https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtImSqn7B6D.woff2) | 300–700 (used at 400–700) | Italic | 39,304 |
| `dm-sans-latin-normal.woff2` | [Google Fonts v17](https://fonts.gstatic.com/s/dmsans/v17/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K6z9mXg.woff2) | 100–1000 | Normal | 36,980 |

The Latin subsets include Swedish `åäöÅÄÖ`. The WOFF2 header, variation axes and
these six glyphs were verified with Next.js's bundled fontkit parser. Characters
outside these subsets use the site's existing system font fallbacks.

Both families use the SIL Open Font License 1.1. The complete copyright notices
and licenses are included in `OFL-Cormorant-Garamond.txt` and `OFL-DM-Sans.txt`,
downloaded from the official Google Fonts repository:

- [Cormorant Garamond license](https://github.com/google/fonts/blob/main/ofl/cormorantgaramond/OFL.txt)
- [DM Sans license](https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt)

Keep the font files and their licenses together when redistributing them.
