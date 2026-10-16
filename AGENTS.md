<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Keep the team guide current

`lib/guide/content.ts` is the BIP Control team guide (shown at /guide, printed at /guide-print, downloaded as Word). When you add, rename, remove or meaningfully change a sidebar tool, update its entry there in the same change and bump `updated`. `lib/guide/content.test.ts` fails when the sidebar and the guide disagree.
