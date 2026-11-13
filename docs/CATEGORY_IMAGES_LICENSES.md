# Category rail photo licences (internal)

Not linked from the Privacy Policy or Terms of Service: the Unsplash License needs no attribution, and the files are self-hosted.

- Licence: [Unsplash License](https://unsplash.com/license): free for commercial use, no permission or credit required. It does not cover trademarks, or the likeness of identifiable people for endorsement.
- Files: `public/categories/{slug}.webp` and `landly-mobile/assets/categories/{slug}.webp` (byte-identical; 960x600 WebP). Nothing is hotlinked.
- Source platform for all 12: Unsplash. Image host id = `images.unsplash.com/photo-{ID}`.
- Visual review (2026-11-13): all 12 are bright, well framed with `object-cover` centred, and legible under the bottom scrim.

## Status: PENDING manual confirmation

The photographer name, the photo page URL and the licence-check date could not be filled from this session. Unsplash photo pages are keyed by a short slug, not by the `photo-{ID}` image id, and a lookup of the page for an ID was not possible. For each row, open the photo in a browser (Unsplash search or a reverse image search of the file), then fill in `Photo page URL`, `Photographer` and `Licence checked`. Replace the photo if it was removed, or is now under a different licence.

| Slug | Category | Photo ID | Subject | Photo page URL | Photographer | Licence checked | SHA-256 (shipped file) |
|---|---|---|---|---|---|---|---|
| restaurants | Restaurants and Cafes | `1517248135467-4c7edcad34c4` | Restaurant interior, set tables | _pending_ | _pending_ | _pending_ | `a5906ee8e381474bc552566b67b09752f9cc49b2df9d751d0f4ce83e894a52c5` |
| beach | Beach and Sea | `1507525428034-b723cf961d3e` | Sunset shoreline, turquoise sea | _pending_ | _pending_ | _pending_ | `0be9402b8594b5f31f2dcf55b7bc4ac52a0e7eab0a949e51c7d7678036680ec0` |
| attractions | Attractions and Tours | `1513889961551-628c1e5e2ee9` | Fairground swing carousel | _pending_ | _pending_ | _pending_ | `5174b7001a6e13c56697e0731b5836dd0a6175fc78fe6907fe8ae637c57d382d` |
| fashion | Fashion and Shopping | `1441986300917-64674bd600d8` | Clothing store, shelves of apparel | _pending_ | _pending_ | _pending_ | `b5ebe9844d8e91ddfaca2c0b16de2f3d310daeb378de62ee40bbb30558ba9836` |
| sport | Sport and Fitness | `1534438327276-14e5300c3a48` | Gym, dumbbell rack | _pending_ | _pending_ | _pending_ | `5fde25f148acb0e6eaf08d6641dd6ed53ebe84d2db1eca053f4bdf30643060b0` |
| tourism | Israel and Global Tourism | `1533105079780-92b9be482077` | Whitewashed village above a blue bay | _pending_ | _pending_ | _pending_ | `f0a87a504e54463940d533230999534927d3afbaf703558b8793f5861f1673b8` |
| pampering | Pampering Bundles | `1544161515-4ab6ce6db874` | Spa massage with oil | _pending_ | _pending_ | _pending_ | `d159a8ff1429f540b29cd1b793cc5ae07dff387fba9c10ee59e697b13c1b0812` |
| beauty | Beauty and Skincare | `1596462502278-27bfdc403348` | Makeup brushes and lipstick flat-lay | _pending_ | _pending_ | _pending_ | `a77371af86b4c2400f80db6d5c50b4bb100749f0b6cfbe7dbdd5980b11ac1c89` |
| home | Home and Furnishing | `1586023492125-27b2c045efd7` | Yellow armchair, lamp, framed print | _pending_ | _pending_ | _pending_ | `6ac22ddf562fca7fc036dad0da133e6dae6f32c8385e97bae982ee36d938fb47` |
| kids | Kids and Baby | `1515488042361-ee00e0ddd4e4` | Toddler playing with toys, top view | _pending_ | _pending_ | _pending_ | `04f429035ee6e948f3e497ea6b3c6e8d88917ff1e0913607b79616db6ee1183a` |
| insurance | Insurance and Savings | `1579621970795-87facc2f976d` | Sprout growing from a jar of coins | _pending_ | _pending_ | _pending_ | `69bc1acb312a3a96d645513726e6bd4972510267e6922bd489ca7a37f2346959` |
| cars | Cars and Transport | `1449965408869-eaa3f722e40d` | Driver's hand on the wheel at dusk | _pending_ | _pending_ | _pending_ | `b710fa99763f751287b1fd1f2a9393fe347d4252589e6217940a5a06b568b221` |

## Notes
- Identifiable people appear in `pampering` (two clients and a therapist) and, only partly, in `cars` (a driver) and `sport` (a gym-goer). Unsplash does not provide model releases. Consider swapping `pampering` for a no-faces spa image if you want to be strict.
- `fashion` shows a "U.S. NAVY" tag on a folded garment; a trademark-neutral frame is a possible swap.
- To change a photo: replace the same file name in both folders, update the row and hash here, and run `shasum -a 256 public/categories/*.webp landly-mobile/assets/categories/*.webp`.
