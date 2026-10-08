# Trainer voice and video calls

Calls use Supabase for authenticated invitations and history, and LiveKit for WebRTC media. Only the two members of an accepted trainer conversation can call each other. A call continues while navigating between pages of the site.

## Activation

1. Create a project at https://cloud.livekit.io.
2. From that project's settings, obtain its WebSocket URL and API key/secret.
3. Configure these **server-only** environment variables in the Vercel project, for each environment where calls should work:

   - `LIVEKIT_URL` — the `wss://...` project URL.
   - `LIVEKIT_API_KEY` — LiveKit API key.
   - `LIVEKIT_API_SECRET` — LiveKit API secret.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — existing server authentication configuration.

4. For local testing, use `.env.local` and run `npm run dev:full`, so the `/api/calls/*` routes are available. Plain `npm run dev` serves only the frontend.
5. Redeploy after setting production variables. HTTPS (or localhost) is required for browser microphone/camera access.

Never prefix LiveKit credentials with `VITE_`: they must not be bundled into the browser. `/api/calls/config` reports only whether the server is configured. Without configuration the call buttons remain unavailable.

## Behavior

- Invitations ring for 45 seconds; no answer is recorded as a missed call.
- Accepting a call enables the microphone. The camera starts off, including in video calls; each participant enables their own camera explicitly.
- Calls show connection/reconnection state, mute/camera controls, an autoplay audio unlock control when required by the browser, and a compact mode that keeps audio playing.
- A page reload shows an explicit Join control rather than opening devices automatically. Signing out disconnects and stops media tracks.
- Each participant sends a heartbeat every 20 seconds. If either participant disappears for 90 seconds, the call expires. The history retains declined, canceled, missed, and ended calls (the last 50 calls per user).
- Only one live invitation/call can involve a trainer at a time; requests are limited to five per minute.
- Blocking the conversation or disabling shared profiles ends its calls. After terminal state changes, the client requests server-side participant removal, cached-token revocation on LiveKit Cloud, and room deletion. Joining credentials are minted only for an accepted, unexpired call, are scoped to its exact room, and have a maximum 60-second initial-join lifetime. Token expiry alone does not disconnect an existing LiveKit participant.

## Verification before enabling publicly

The automated tests cover access controls, lifecycle, device cleanup, and UI behavior with mocked browser media. A real media test requires LiveKit credentials and two authenticated trainer sessions. Test voice, video, mute, camera permission denial, minimization/navigation, rejected/missed calls, hang-up, blocked conversations, and reconnection on both desktop and mobile. No recording is enabled by this integration.
