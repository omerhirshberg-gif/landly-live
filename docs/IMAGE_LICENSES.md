# Guest hero photo licences (internal)

The four photographs in the guest landing's hero gallery (`components/landing/IsraelLifestyleCollage.tsx`). The category rail photos are documented separately in [CATEGORY_IMAGES_LICENSES.md](./CATEGORY_IMAGES_LICENSES.md).

- Licence: [Unsplash License](https://unsplash.com/license): free for commercial use, no permission or credit required. It does not cover trademarks, or the likeness of identifiable people for endorsement.
- Files: `public/images/hero/{name}.webp` (1200px wide) and `{name}-sm.webp` (640px wide), converted with `cwebp` from the 1800px JPEG Unsplash serves. Self-hosted: nothing is hotlinked.
- Each photo page was read on **2026-11-14** (`cafe`, `beach`, `market` in a browser; `life` through a plain page fetch, because Unsplash blocks headless browsers); each states "Free to use under the Unsplash License" (not Unsplash+, not Getty/iStock).
- Faces: none identifiable. Beach figures are tiny and distant; the market shows one blurred, masked passer-by behind the fruit. Unsplash provides no model releases.
- Photos were rejected for: Getty/Unsplash+ licence, not clearly Israel, or identifiable faces (a Nachalat Binyamin market street was dropped for visible faces).

| File | Subject | Place | Photographer | Photo page | Image id | Licence checked |
|---|---|---|---|---|---|---|
| `cafe` | Croissants, tea board and a Tel Aviv street seen through a sunlit café window; no people (cropped 4:3 from the left of the 16:9 original, which excludes a woman at the right edge) | Tel Aviv | Vladimir Visotsky | https://unsplash.com/photos/a-bakery-counter-filled-with-pastries-next-to-a-window-wsj7uJh7Iec | `1681838675906-b91be4457fb1` | 2026-11-14 |
| `beach` | Jaffa beach, old city on the hill, turquoise sea | Tel Aviv-Yafo (Homat HaYam promenade) | Pontus Wellgraf | https://unsplash.com/photos/people-on-the-beach-photography-7_2Peqe4rPs | `1556861458-41759cadc36f` | 2026-11-14 |
| `market` | Pomegranates and mandarins at a market stall | Mahane Yehuda Market, Jerusalem | Ilanit Ohana | https://unsplash.com/photos/a-pile-of-pomegranates-sitting-on-top-of-a-pile-of-orange-EP5xFvnM36o | `1645028846887-910d7daff99f` | 2026-11-14 |
| `life` | Tel Aviv promenade, palms and sea, walkers small and turned away (cropped square from the portrait original) | Tel Aviv | Levi Meir Clancy | https://unsplash.com/photos/a-group-of-people-walking-down-a-sidewalk-next-to-the-ocean-RH154P_F9jw | `1631596894729-4c8d7463bd61` | 2026-11-14 |

The earlier Bauhaus facade photo (Anders J, `1553323122-6c81666fc9d2`) was replaced by this café photo; its files were overwritten, so none remain. This café is a street-side window counter, not an outdoor table: the outdoor candidate found (Herzliya, not Tel Aviv) was passed over. `life` and `cafe` pages were read through a plain page fetch.

## SHA-256 (shipped files)

| File | SHA-256 |
|---|---|
| `beach.webp` | `24407ec779bb44cc6ae4415e25337f0f3683487ea88c7c640d9fc1102fdf7c2e` |
| `beach-sm.webp` | `d73940234c4c3cbd5a0452ec28b1158e982f26421e751770d00b480f89464eb1` |
| `cafe.webp` | `6b0e718c637b4a1b87e6458e745a7108d4749b74c00ac12806d4ee138e62f89c` |
| `cafe-sm.webp` | `831a4b9c9752cf2d9cb736607c5f7731caba7a0fa2ad540813b61d3d482e227d` |
| `market.webp` | `97bb7c38a557432712611235d5be1ca42de2dbe5057da4d085e3cb401a0f36ea` |
| `life.webp` | `3976321453703cc379f2116558fd6c791747687518718431e24c975e4d7e138d` |
| `life-sm.webp` | `feb557b638a6e53f456d5a6b03b318d23f482073d0324f745c3efaeb263b853d` |
| `market-sm.webp` | `28973a980723001ac399f998e6378c3aee7a9f68ec394b530f9e648b310bd40e` |

To change a photo: replace both files, update the row and hashes here, and run `shasum -a 256 public/images/hero/*.webp`.
