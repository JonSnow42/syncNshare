# Faculty demo checklist

Use separate browser profiles for the two accounts. For the local demo, run `npm start` and open `http://localhost:3000` in both profiles.

| Scenario | Expected result | Status |
| --- | --- | --- |
| Register two users; reload | Both remain signed in | API signup and cookie issuance passed; browser reload not tested |
| Google sign-in | Google account creates or returns to a profile | Requires Google OAuth environment values; not tested with real credentials |
| Edit profile name and bio | Changes show on profile | Not tested in browser |
| Follow/unfollow the second account | Follow button toggles and persists | API follow passed; browser persistence not tested |
| Set activity visibility to followers/nobody | Activity appears only to authorized viewers | Server visibility logic implemented; cross-account browser check not tested |
| Create and discover a public room | Room appears in discovery and can be joined | Public endpoint implemented; full browser flow not tested |
| Create a private room | Not listed publicly; room ID alone returns 403 to outsider | Private room ID denial passed in API smoke test |
| Join private room by invite | Valid code joins; invalid code returns an error | Invite join passed in API smoke test |
| Add a YouTube URL/ID | Track is queued; unsupported IDs return an error | Valid-format queue request passed; embed playback not verified |
| Add a YouTube playlist URL | Full playlist opens in the embedded YouTube player | Implemented; live playback not tested |
| Vote, send chat, refresh room | Vote and message persist for members | API vote and chat passed; refresh/browser display not tested |
| Access private chat as outsider | Denied until room membership | Membership guard implemented; message endpoint tested as a member |
| Host changes track/status | State persists and refreshes for members | Implemented; browser synchronization not tested |

## Local API smoke test evidence

On 2026-10-15, two distinct accounts were created against the local server and one account signed back in. Signup returned 201 for both and login returned 200; a non-member's direct private-room read returned 403; invite join, queue add, message post, vote, and follow returned successful status codes (200/201).

On 2026-10-15, an isolated server returned the home page and refined stylesheet successfully; the Google provider reported unavailable without credentials; the Google OAuth route returned the expected 503 setup response; API queue additions returned 201 for one video and one playlist.

## Public deployment

Not deployed; no public URL is available to test. A persistent hosting account and durable database setup are still required.
