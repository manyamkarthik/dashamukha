# Portraits

Drop portrait images here and the viewer uses them instead of the icons: inside
each head's orb on the stage, inside Ravana's core, and as the faces in the report.
Nothing else to configure: the viewer picks up whatever files exist.

| File | Needed | What it is |
| --- | --- | --- |
| `kama.png` … `buddhi.png` | yes | The head, face centered, mouth closed |
| `ravana.png` | optional | Ravana, shown inside the core at the centre |
| `<id>-talk.png` | optional | Same image, mouth slightly open, shown while that head speaks |

Ids: `kama krodha moha lobha mada ahamkara matsarya ghrina bhaya buddhi`.
PNG, WebP, JPEG and AVIF all work. Square images, 1024px or larger.

Every image is cropped to a circle, so keep the face inside the middle 60% of the
frame. Make `-talk` frames by *editing* the base image, so only the mouth changes;
anything else that shifts between frames will flicker.

## Prompts

Generate Ravana first. Then generate each head with one finished head attached
and "Match the style, lighting and finish of the attached image" added to the
prompt, so the set looks like one family. Attach a head other than Ravana for
Lobha and Matsarya, or the image model reuses Ravana's face. Generate one image
per prompt, not several in one. Paste the style block, then the head's line.

**Style block (same for every image):**

> Cinematic dark-fantasy portrait in the style of a premium Indian-epic game
> splash art. Head and shoulders only, facing the camera, face centered in the
> middle of a square 1:1 frame, eyes at the exact center height. Painterly but
> photoreal skin, fine detail in jewelry and fabric. Dramatic low-key lighting:
> soft warm key light from upper left, a strong colored rim light from behind in
> **[COLOR]**. Plain, almost black background (#07080B) with a faint glow of
> **[COLOR]** behind the head. No text, no border, no frame, no circle, no logo,
> no hands, nothing touching the edges of the image.

**Heads (one line each, fill [COLOR] from the line):**

| File | Prompt |
| --- | --- |
| `ravana.png` | Ravana, the ten-headed king of Lanka. One large central face looking straight at the camera, regal and calm with quiet menace, thick upturned moustache, tall ornate golden crown with rubies; nine smaller crowned heads recede to the left and right behind it, all inside the frame. Rich gold and deep purple robes. [COLOR] = warm gold (#F2C25A) |
| `kama.png` | Kama, Desire: a young, beautiful figure with a dreamy, longing half-smile and soft eyes, jasmine flowers in the hair, delicate gold earrings. [COLOR] = warm orange (#E2702A) |
| `krodha.png` | Krodha, Anger: a fierce warrior, brows crushed down, jaw clenched, eyes burning, the tip of a trident just visible over one shoulder. [COLOR] = deep red (#D93448) |
| `moha.png` | Moha, Attachment: a gentle, wistful figure with half-lidded eyes and a sad, tender smile, a thin string of beads at the neck. [COLOR] = teal (#14A8B8) |
| `lobha.png` | Lobha, Greed: a heavyset merchant, NOT a king, NO crown. Bare head with oiled hair, fleshy face, thin moustache, several heavy gold chains and a coin necklace, gold rings in his ears, sly narrowed eyes and a hungry, calculating grin. A different face from any king. [COLOR] = gold (#C99A1E) |
| `mada.png` | Mada, Pride: an elder king with a long white beard, chin raised, arrogant smirk, tall jeweled crown. [COLOR] = royal purple (#7C4DDB) |
| `ahamkara.png` | Ahamkara, Ego: a regal young prince with a calm, superior, straight gaze, perfectly groomed, a single large gem on the forehead. [COLOR] = magenta violet (#A94FD8) |
| `matsarya.png` | Matsarya, Envy: a thin courtier in a simple silk turban, NO crown, clean-shaven, hollow cheeks, eyes turned sharply to the side, glancing at someone else with resentment, lips pressed tight. [COLOR] = emerald green (#2FA35A) |
| `ghrina.png` | Ghrina, Aversion: a stern ascetic with ash marks on the forehead, nose wrinkled and upper lip curled in distaste. [COLOR] = olive green (#6E9F2A) |
| `bhaya.png` | Bhaya, Fear: a figure in a dark hood, wide frightened eyes, raised brows, lips slightly parted. [COLOR] = cool blue (#3D6BE0) |
| `buddhi.png` | Buddhi, Intellect: a serene scholar with calm, focused eyes and a slight thoughtful frown, simple clothes, rudraksha beads. [COLOR] = sky blue (#2F8FE8) |

**Talk frames (optional), with the base image attached:**

> Edit this image: open the mouth slightly as if speaking mid-word. Change nothing
> else: same face, pose, lighting, crop and background.
