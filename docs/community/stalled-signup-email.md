# Email to signups who never added a device (draft)

Send by hand from your own address, one at a time, to accounts that confirmed their email but have no device or feed (`pnpm ops:funnel` shows the count). Skip your own test accounts. The goal is a reply, not a conversion: one honest answer about what stopped them is worth more than the funnel numbers.

Keep it plain text. Do not add tracking links or an unsubscribe-style footer; this is a personal note, and you should only send it once.

---

**Subject:** Quick question about ThermalTrace

Hi,

I'm Robert, I built ThermalTrace. You signed up a little while ago and I noticed no sensor ever got connected.

Would you mind telling me what stopped you? A one-line reply is plenty. For example:

- I don't have an ESP32 or a sensor yet
- The setup looked like more work than I wanted
- I already use Home Assistant / another sensor and wasn't sure how it fits
- I was just looking around

If you were hoping to watch a specific space (garage, crawlspace, cabin), tell me which and what you have on hand, and I'll tell you the shortest way to get a reading, or tell you honestly if a different product fits better.

Thanks,
Robert

---

## What to do with replies

- "No hardware": point them at `/about/esp32-freeze-kit`, and note it as a vote for a pre-flashed kit.
- "Too much work": ask which step. This is the case the browser flasher is meant to fix.
- "Already have sensors": ask which brand. Repeated answers tell you which integration to build first.
- Keep a tally in this file or an issue so the pattern is visible after ten replies.
