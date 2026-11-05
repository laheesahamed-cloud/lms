# Prompt for Codex: build one OSCE case with its images

Copy everything under **"The prompt"** into Codex and fill in the three values at the top.
For example: `CONDITION: Liver cirrhosis`, `STATION TYPE: long`. Codex then replies with the full
`case.json` in the chat and shows every picture it makes. It needs image generation turned on and the
repo open, so it can save the files. A complete worked example (21 findings, 42 picture slots) and a
long-case example are inside the prompt below, so it doesn't depend on any other file.

---

## The prompt

```
CONDITION:      <e.g. Liver cirrhosis>
STATION TYPE:   <short  |  long>          (short = examination-led, long = history-led)
CATEGORY HINT:  <e.g. MBBS_MEDICINE / GASTROENTEROLOGY>
```

You are producing ONE complete OSCE station for the xyndrome learning app: a case file that the
admin importer accepts, plus every picture it needs, named and sized so they can be dropped
straight into the app. Work inside a new folder `docs/osce/cases/<slug>/` where `<slug>` is the
condition in lower-case kebab-case.

### 1. The exact format, and the standard to match

These are working samples that import cleanly. Copy their SHAPE key for key and do not invent new
fields. The importer rejects an unknown `station_type`, a hotspot outside 0 to 1, a hotspot
pointing at a finding or scene that does not exist, or a duplicate slug.

**SHORT case: a FULL WORKED EXAMPLE. This is the depth and breadth to match or exceed.** It has
6 scenes, 21 findings across 5 regions and all four techniques (Look, Feel, Percuss, Listen),
7 mechanism steps, 8 investigations, 4 treatment groups, a 6-section checklist and 10 viva
questions. It declares 42 picture slots: 6 scenes, one for each visible finding, technique photos
for the Feel, Percuss and Listen findings, 5 normal comparisons and 7 mechanism illustrations.
Study how each finding is written: what it looks like, then how to elicit it step by step with
"Normal:" and "Pitfall:", then the mechanism and significance.

```json
{
 "format_id": "osce.bulk-import",
 "format_version": "1.0.0",
 "import_options": {
  "create_as_draft": true
 },
 "cases": [
  {
   "slug": "liver-cirrhosis-short",
   "title": "Decompensated Liver Cirrhosis — Abdominal Short Case",
   "summary": "Examination of an adult with decompensated chronic liver disease: peripheral stigmata, ascites, portal hypertension and encephalopathy.",
   "station_type": "short",
   "difficulty": "intermediate",
   "course_ref": "MBBS_MEDICINE",
   "topic_ref": "GASTROENTEROLOGY",
   "is_public": false,
   "is_free": false,
   "case_data": {
    "version": 1,
    "scenes": [
     {
      "id": "body",
      "label": "Full patient",
      "region": "general",
      "slot_key": "scene:body",
      "brief": "Full-length front view of the same 56-year-old man: lean build with visible muscle wasting, medium-brown skin, short dark hair greying at the temples, plain pale-blue hospital gown, neutral hospital examination room, soft even clinical lighting, standing; abdomen visibly distended beneath the gown, mild yellow tinge to the face, slim arms and legs with visible wasting, portrait framing. No text, no labels, no arrows.",
      "hotspots": [
       {
        "label": "Face and eyes",
        "x": 0.5,
        "y": 0.11,
        "target_type": "scene",
        "target_id": "head"
       },
       {
        "label": "Hands",
        "x": 0.27,
        "y": 0.55,
        "target_type": "scene",
        "target_id": "hands"
       },
       {
        "label": "Chest",
        "x": 0.5,
        "y": 0.27,
        "target_type": "scene",
        "target_id": "chest"
       },
       {
        "label": "Abdomen",
        "x": 0.5,
        "y": 0.43,
        "target_type": "scene",
        "target_id": "abdomen"
       },
       {
        "label": "Legs",
        "x": 0.5,
        "y": 0.78,
        "target_type": "scene",
        "target_id": "legs"
       }
      ]
     },
     {
      "id": "head",
      "label": "Face and eyes",
      "region": "head",
      "slot_key": "scene:head",
      "brief": "FRAMING: head and upper neck of the same patient, portrait crop from the top of the head to the collarbones. Mild jaundice of the eyes and skin, mild fullness in front of the ears, hollowed temples. medium-brown skin, adult male, lean; same pale-blue hospital gown where any is in frame. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. No text, no labels, no arrows.",
      "hotspots": [
       {
        "label": "Sclerae",
        "x": 0.5,
        "y": 0.43,
        "target_type": "sign",
        "target_id": "scleral-jaundice"
       },
       {
        "label": "Parotid region",
        "x": 0.2,
        "y": 0.55,
        "target_type": "sign",
        "target_id": "parotid-enlargement"
       },
       {
        "label": "Temples",
        "x": 0.28,
        "y": 0.3,
        "target_type": "sign",
        "target_id": "temporal-wasting"
       }
      ]
     },
     {
      "id": "hands",
      "label": "Hands and arms",
      "region": "hands",
      "slot_key": "scene:hands",
      "brief": "FRAMING: both hands and forearms of the same patient held out in front, palms up, cropped at the elbows. A few forearm bruises. medium-brown skin, adult male, lean; same pale-blue hospital gown where any is in frame. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. No text, no labels, no arrows.",
      "hotspots": [
       {
        "label": "Palms",
        "x": 0.3,
        "y": 0.5,
        "target_type": "sign",
        "target_id": "palmar-erythema"
       },
       {
        "label": "Nails",
        "x": 0.55,
        "y": 0.2,
        "target_type": "sign",
        "target_id": "leuconychia"
       },
       {
        "label": "Fingertips",
        "x": 0.75,
        "y": 0.22,
        "target_type": "sign",
        "target_id": "clubbing"
       },
       {
        "label": "Palmar fascia",
        "x": 0.33,
        "y": 0.7,
        "target_type": "sign",
        "target_id": "dupuytren"
       },
       {
        "label": "Outstretched hands",
        "x": 0.6,
        "y": 0.55,
        "target_type": "sign",
        "target_id": "asterixis"
       },
       {
        "label": "Forearms",
        "x": 0.5,
        "y": 0.88,
        "target_type": "sign",
        "target_id": "forearm-bruising"
       }
      ]
     },
     {
      "id": "chest",
      "label": "Chest and upper trunk",
      "region": "chest",
      "slot_key": "scene:chest",
      "brief": "FRAMING: bare upper chest and shoulders of the same patient, front view, from the collarbones to the lower ribs, decently draped below. A few spider naevi, mild bilateral breast enlargement, sparse chest hair. No face. medium-brown skin, adult male, lean; same pale-blue hospital gown where any is in frame. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. No text, no labels, no arrows.",
      "hotspots": [
       {
        "label": "Upper chest skin",
        "x": 0.4,
        "y": 0.28,
        "target_type": "sign",
        "target_id": "spider-naevi"
       },
       {
        "label": "Breast tissue",
        "x": 0.62,
        "y": 0.5,
        "target_type": "sign",
        "target_id": "gynaecomastia"
       },
       {
        "label": "Chest hair",
        "x": 0.5,
        "y": 0.4,
        "target_type": "sign",
        "target_id": "body-hair-loss"
       }
      ]
     },
     {
      "id": "abdomen",
      "label": "Abdomen",
      "region": "abdomen",
      "slot_key": "scene:abdomen",
      "brief": "FRAMING: the abdomen of the same patient lying at 45 degrees, from the lower ribs to the pelvis, groin covered. Distended with bulging flanks, an everted umbilicus and a few dilated periumbilical veins. No face. medium-brown skin, adult male, lean; same pale-blue hospital gown where any is in frame. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. No text, no labels, no arrows.",
      "hotspots": [
       {
        "label": "Abdominal contour",
        "x": 0.5,
        "y": 0.52,
        "target_type": "sign",
        "target_id": "ascites-distension"
       },
       {
        "label": "Umbilicus",
        "x": 0.5,
        "y": 0.42,
        "target_type": "sign",
        "target_id": "caput-medusae"
       },
       {
        "label": "Right upper quadrant",
        "x": 0.3,
        "y": 0.3,
        "target_type": "sign",
        "target_id": "liver-edge"
       },
       {
        "label": "Left upper quadrant",
        "x": 0.72,
        "y": 0.3,
        "target_type": "sign",
        "target_id": "splenomegaly"
       },
       {
        "label": "Right flank",
        "x": 0.12,
        "y": 0.55,
        "target_type": "sign",
        "target_id": "fluid-thrill"
       },
       {
        "label": "Left flank",
        "x": 0.88,
        "y": 0.58,
        "target_type": "sign",
        "target_id": "shifting-dullness"
       },
       {
        "label": "Epigastrium",
        "x": 0.5,
        "y": 0.25,
        "target_type": "sign",
        "target_id": "venous-hum"
       }
      ]
     },
     {
      "id": "legs",
      "label": "Legs and feet",
      "region": "legs",
      "slot_key": "scene:legs",
      "brief": "FRAMING: both lower legs and feet of the same patient resting on a couch, from just below the knees to the feet. Visible bilateral ankle and shin swelling and a few small bruises. No face and no torso. medium-brown skin, adult male, lean; same pale-blue hospital gown where any is in frame. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. No text, no labels, no arrows.",
      "hotspots": [
       {
        "label": "Shins",
        "x": 0.45,
        "y": 0.45,
        "target_type": "sign",
        "target_id": "pitting-oedema"
       },
       {
        "label": "Lower leg skin",
        "x": 0.62,
        "y": 0.7,
        "target_type": "sign",
        "target_id": "shin-bruising"
       }
      ]
     }
    ],
    "signs": [
     {
      "id": "scleral-jaundice",
      "name": "Scleral jaundice",
      "method": "inspection",
      "region": "head",
      "scene_id": "head",
      "what": "Diffuse yellow discolouration of both sclerae. It becomes visible in natural light once the bilirubin is roughly 40 µmol/L (2.5 mg/dL) or more, and in advanced disease the skin turns yellow too.",
      "how": "Sit the patient up and use natural daylight, because yellow artificial light hides jaundice. Ask them to look up, down and to each side while you gently retract the lower lids and inspect the sclerae, not the conjunctivae. Normal: white sclerae. Pitfall: carotenaemia from carrots or fruit turns the skin orange but spares the sclerae.",
      "why": "Failing hepatocytes cannot take up, conjugate and excrete bilirubin, so it builds up and stains elastin-rich tissue such as the sclerae. In a cirrhotic it marks decompensation and a worse outlook.",
      "media_slot": "sign:scleral-jaundice",
      "brief": "FRAMING: extreme close-up of both eyes and the bridge of the nose only, from eyebrows to cheekbones. Diffuse yellow sclerae; the lower lid gently retracted. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. No text, no labels, no arrows.",
      "compare": {
       "label": "Normal",
       "media": "sign:scleral-jaundice-normal"
      }
     },
     {
      "id": "parotid-enlargement",
      "name": "Parotid enlargement",
      "method": "inspection",
      "region": "head",
      "scene_id": "head",
      "what": "Bilateral painless swelling in front of and below the ears that fills out the angle of the jaw.",
      "how": "Stand in front of the patient and compare both cheeks from the front, then from each side. Palpate the glands, which are soft and non-tender in alcohol-related disease. Normal: a visible angle of the jaw and no swelling in front of the ear. Pitfall: swelling on one side only needs another explanation, such as infection or a tumour.",
      "why": "Seen with chronic alcohol excess and malnutrition through enlargement of the salivary glands. It points to the cause rather than to cirrhosis itself.",
      "media_slot": "sign:parotid-enlargement",
      "brief": "FRAMING: head and neck only, three-quarter view from forehead to chin. Mild symmetrical fullness in front of both ears and over the angle of the jaw. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. No text, no labels, no arrows."
     },
     {
      "id": "temporal-wasting",
      "name": "Temporal wasting",
      "method": "inspection",
      "region": "head",
      "scene_id": "head",
      "what": "Hollowing of the temples with loss of muscle bulk, part of generalised muscle wasting.",
      "how": "Look at the temples from the front and side while the patient relaxes the jaw. Then look at the shoulders and thighs for the same wasting. Normal: a smooth, rounded temple. Pitfall: age alone causes some hollowing, so judge it together with the shoulders and thighs.",
      "why": "Protein-calorie malnutrition, poor hepatic handling of protein and glycogen, and a catabolic state cause sarcopenia. Its presence predicts a worse outcome.",
      "media_slot": "sign:temporal-wasting",
      "brief": "FRAMING: side view of the head from forehead to ear only. Hollowed temple with loss of muscle bulk. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. No text, no labels, no arrows."
     },
     {
      "id": "palmar-erythema",
      "name": "Palmar erythema",
      "method": "inspection",
      "region": "hands",
      "scene_id": "hands",
      "what": "Symmetrical redness of the thenar and hypothenar eminences and the finger pulps, with the centre of the palm spared.",
      "how": "Ask the patient to hold both hands out with the palms up in good light and compare them. Press on the skin to see it blanch and refill. Normal: pink palms of uniform colour. Pitfall: pregnancy, thyrotoxicosis and rheumatoid arthritis also cause it, so it is not specific to the liver.",
      "why": "Altered metabolism of sex hormones, mainly raised oestrogen, together with peripheral vasodilatation. It is a common stigma of chronic liver disease.",
      "media_slot": "sign:palmar-erythema",
      "brief": "FRAMING: close-up of both palms only, held up, cropped at the wrists. Clear redness of the thenar and hypothenar eminences with the centre of the palm spared. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows.",
      "compare": {
       "label": "Normal",
       "media": "sign:palmar-erythema-normal"
      }
     },
     {
      "id": "leuconychia",
      "name": "Leuconychia",
      "method": "inspection",
      "region": "hands",
      "scene_id": "hands",
      "what": "White nails with an opaque white nail bed, usually in several nails, so that the pink of the nail bed is lost.",
      "how": "Look at all ten nails against a plain background in good light. Press on a nail to confirm the white colour does not blanch away. Normal: a pink nail bed. Pitfall: a single white mark after a knock is a normal variant and is not leuconychia.",
      "why": "Low serum albumin from reduced hepatic synthesis alters the nail bed, so the nail looks white. It points to chronic hypoalbuminaemia.",
      "media_slot": "sign:leuconychia",
      "brief": "FRAMING: macro close-up of the fingertips and nails of one hand on a plain background. Several opaque white nails with no visible pink nail bed. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows.",
      "compare": {
       "label": "Normal",
       "media": "sign:leuconychia-normal"
      }
     },
     {
      "id": "clubbing",
      "name": "Finger clubbing",
      "method": "inspection",
      "region": "hands",
      "scene_id": "hands",
      "what": "Loss of the angle between the nail and the nail fold, a spongy nail bed and a bulbous fingertip.",
      "how": "Look at the finger from the side for loss of the normal angle of about 160 degrees. Test the Schamroth window by placing the nails of two opposing fingers together; clubbing closes the small diamond-shaped gap. Normal: a visible window. Pitfall: clubbing is non-specific and also occurs with lung, heart and bowel disease.",
      "why": "Seen in cirrhosis, probably through intrapulmonary shunting and vascular changes. It is a less common stigma and does not point to the cause.",
      "media_slot": "sign:clubbing",
      "brief": "FRAMING: side-on close-up of one index finger from the fingertip to the first knuckle. Loss of the nail-fold angle and a bulbous fingertip. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "dupuytren",
      "name": "Dupuytren contracture",
      "method": "inspection",
      "region": "hands",
      "scene_id": "hands",
      "what": "Thickening and puckering of the palmar fascia with a fixed bend of the ring finger, and sometimes the little finger.",
      "how": "Inspect the palm for puckered skin and nodules, then feel for a firm cord running to the finger. Ask the patient to lay the hand flat on a table (the table-top test). Normal: a smooth palm and a hand that lies flat. Pitfall: it is common in older men without liver disease, so it supports but does not prove an alcohol link.",
      "why": "Associated with alcohol excess and chronic liver disease, although the mechanism is not clear. It points to a likely cause.",
      "media_slot": "sign:dupuytren",
      "brief": "FRAMING: close-up of one open palm and the fingers, cropped at the wrist. A fibrous cord and puckered skin running to a bent ring finger. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "asterixis",
      "name": "Asterixis (flapping tremor)",
      "method": "inspection",
      "region": "hands",
      "scene_id": "hands",
      "what": "A coarse, irregular flapping of the outstretched hands as the wrists briefly lose their posture and drop, a sign of hepatic encephalopathy.",
      "how": "Ask the patient to stretch both arms out in front with the wrists bent back and the fingers spread, and to hold the pose for at least 30 seconds while you watch. Normal: a steady hand. Pitfall: the patient must be able to follow the instruction, and it is also seen in renal and respiratory failure.",
      "why": "Toxins that the diseased liver and portosystemic shunts no longer clear, mainly ammonia, impair the brain's control of a sustained posture. It marks encephalopathy, a sign of decompensation.",
      "media_slot": "sign:asterixis",
      "brief": "FRAMING: both arms stretched out in front, seen from the front, from the elbows to the fingertips only. Wrists bent back and fingers spread; the hands slightly blurred to suggest the flap. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "forearm-bruising",
      "name": "Bruising and purpura",
      "method": "inspection",
      "region": "hands",
      "scene_id": "hands",
      "what": "Scattered bruises and small purpuric spots on the forearms, often after minor knocks.",
      "how": "Look at the forearms and hands in good light and ask about easy bruising or bleeding from the gums. Note the colour, size and distribution. Normal: clear skin or a single bruise with a clear history. Pitfall: steroids, aspirin, anticoagulants and age also cause bruising.",
      "why": "The liver makes most clotting factors, and hypersplenism lowers the platelet count, so bleeding tendency increases. It marks reduced synthetic function.",
      "media_slot": "sign:forearm-bruising",
      "brief": "FRAMING: close-up of both forearms from wrist to elbow. Several small bruises and purpuric spots of different ages. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "spider-naevi",
      "name": "Spider naevi",
      "method": "inspection",
      "region": "chest",
      "scene_id": "chest",
      "what": "Small red lesions with a central arteriole and fine radiating legs that blanch on pressure. Five or more is significant.",
      "how": "Inspect the face, neck, upper chest and arms, which are the area drained by the superior vena cava. Press the centre with a pin head or glass slide to see the lesion blanch and then refill from the centre. Normal: no more than one or two. Pitfall: a few are normal, and they also occur in pregnancy.",
      "why": "Raised oestrogen, because the liver clears it poorly, dilates cutaneous arterioles. They are a classic stigma of chronic liver disease.",
      "media_slot": "sign:spider-naevi",
      "brief": "FRAMING: close-up of the upper chest and the base of the neck only. Several spider naevi, each a red central dot with fine radiating vessels. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "gynaecomastia",
      "name": "Gynaecomastia",
      "method": "inspection",
      "region": "chest",
      "scene_id": "chest",
      "what": "Palpable breast tissue in a man, usually on both sides, as a firm rubbery disc behind the nipple.",
      "how": "With consent, inspect the chest from the front, then palpate behind each nipple with the patient lying at 45 degrees. Feel a firm glandular disc, not just soft fat. Normal: no palpable glandular tissue. Pitfall: spironolactone, a common treatment, also causes gynaecomastia, so ask about drugs.",
      "why": "A higher ratio of oestrogen to androgen, from poor hepatic clearance of oestrogen and altered binding, stimulates breast tissue. Spironolactone adds to it.",
      "media_slot": "sign:gynaecomastia",
      "brief": "FRAMING: front view of the chest from the collarbones to the lower ribs only, draped below. Mild symmetrical breast enlargement. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "body-hair-loss",
      "name": "Loss of body hair",
      "method": "inspection",
      "region": "chest",
      "scene_id": "chest",
      "what": "Sparse chest and axillary hair, with a change to a female pattern of hair distribution.",
      "how": "Look at the chest and axillae and, with consent and appropriate draping, the pubic hair pattern. Compare with what is normal for the patient's age and ethnicity. Normal: a male pattern with hair on the chest and axilla. Pitfall: some men and some ethnic groups have little chest hair, so judge it with the other stigmata.",
      "why": "A shift in the balance of sex hormones, with relatively more oestrogen, reduces androgen-dependent hair growth. It is a late feature of chronic liver disease.",
      "media_slot": "sign:body-hair-loss",
      "brief": "FRAMING: close-up of the upper chest and one armpit. Sparse chest hair and a hairless axilla. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "ascites-distension",
      "name": "Abdominal distension with ascites",
      "method": "inspection",
      "region": "abdomen",
      "scene_id": "abdomen",
      "what": "A symmetrically distended abdomen with bulging flanks and, when the ascites is tense, an everted umbilicus and tight shiny skin.",
      "how": "Lay the patient at 45 degrees or flat and expose the abdomen from the nipples to the groin. Look from the foot of the bed and from the side at the contour, the flanks, the umbilicus and any striae or scars. Normal: a flat or gently curved abdomen with an inverted umbilicus. Pitfall: obesity, bowel obstruction and large masses also distend the abdomen, so confirm the fluid with percussion.",
      "why": "Portal hypertension, splanchnic vasodilatation, renal sodium and water retention and a low albumin let fluid collect in the peritoneal cavity. It is the commonest decompensating event.",
      "media_slot": "sign:ascites-distension",
      "brief": "FRAMING: the abdomen only, from the lower ribs to the pelvis, patient lying at 45 degrees, groin covered. Symmetrically distended abdomen with bulging flanks, tight skin and an everted umbilicus. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows.",
      "compare": {
       "label": "Normal",
       "media": "sign:ascites-distension-normal"
      }
     },
     {
      "id": "caput-medusae",
      "name": "Abdominal wall collaterals",
      "method": "inspection",
      "region": "abdomen",
      "scene_id": "abdomen",
      "what": "Dilated veins radiating outwards from the umbilicus across the abdominal wall, like the head of Medusa. It is uncommon.",
      "how": "Expose the abdomen and look at the skin around the umbilicus and the flanks. To find the direction of flow, empty a short segment of vein with two fingers and see which end refills first. Normal: no visible veins, or fine veins in a thin patient. Pitfall: in inferior vena cava obstruction the flow in the flank veins is upwards, which differs from caput, where it is away from the umbilicus.",
      "why": "Raised portal pressure reopens the paraumbilical veins, which connect the portal and systemic circulations and carry blood away from the umbilicus.",
      "media_slot": "sign:caput-medusae",
      "brief": "FRAMING: close-up of the abdominal skin around the umbilicus only. Several modestly dilated superficial veins radiating from the umbilicus, clinically plausible. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "liver-edge",
      "name": "Liver size and edge",
      "method": "palpation",
      "region": "abdomen",
      "scene_id": "abdomen",
      "what": "In established cirrhosis the liver is often small and hard, with a nodular edge that may not be palpable at all. In early or alcohol-related disease it can still be enlarged and firm.",
      "how": "Lay the patient flat with the knees slightly bent. Start in the right iliac fossa and palpate upwards with the flat of the fingers, moving in time with breathing, until you meet the edge. Then percuss from the nipple line down for the upper border. Normal: a soft edge at or just under the costal margin that moves with respiration. Pitfall: with large ascites the liver is hard to feel, so use dipping or ballotting.",
      "why": "Fibrosis and nodular regeneration distort the liver and, over time, shrink it, so it feels firm. A small, shrunken liver is typical of advanced disease.",
      "media_slot": "sign:liver-edge",
      "brief": "FRAMING: close-up of the right upper abdomen with an examiner's hand palpating under the right costal margin; only the hand and the abdomen are in view. The flat of the fingers placed correctly below the rib margin. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "splenomegaly",
      "name": "Splenomegaly",
      "method": "palpation",
      "region": "abdomen",
      "scene_id": "abdomen",
      "what": "A palpable spleen tip below the left costal margin that moves downwards on inspiration and has a notch on its edge.",
      "how": "Start palpating in the right iliac fossa and move diagonally towards the left costal margin on each breath until the tip meets the fingers. Then roll the patient onto the right side and repeat. Percuss over the lowest left ribs. Normal: the spleen is not palpable. Pitfall: a left kidney also moves with breathing, but it has no notch, is ballotable and has resonant bowel in front of it.",
      "why": "Raised portal pressure causes back-pressure in the splenic vein, so the spleen enlarges and traps blood cells (hypersplenism). It supports portal hypertension and explains a low platelet count.",
      "media_slot": "sign:splenomegaly",
      "brief": "FRAMING: close-up of the left upper abdomen with an examiner's hand palpating under the left costal margin; only the hand and the abdomen are in view. Fingers pointing towards the left costal margin. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "fluid-thrill",
      "name": "Fluid thrill",
      "method": "palpation",
      "region": "abdomen",
      "scene_id": "abdomen",
      "what": "A tap on one flank sends a ripple across the abdomen that is felt by the opposite hand, which shows a large volume of ascites.",
      "how": "Ask the patient or an assistant to rest the edge of one hand firmly on the midline of the abdomen to stop the wave travelling through fat. Place one palm on a flank and flick the opposite flank with a finger of the other hand. Normal: no wave is felt. Pitfall: the sign is only reliable for large ascites, so a negative test does not exclude fluid.",
      "why": "The wave travels quickly through free peritoneal fluid, which is why it only appears when there is a large volume.",
      "media_slot": "sign:fluid-thrill",
      "brief": "FRAMING: the abdomen only, showing the examiner's two hands on opposite flanks and an assistant's hand on the midline. One hand flicking one flank while the other palm rests on the opposite flank. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "shifting-dullness",
      "name": "Shifting dullness",
      "method": "percussion",
      "region": "abdomen",
      "scene_id": "abdomen",
      "what": "Dullness in the flanks that moves to the upper flank when the patient rolls onto their side, while the area over the bowel at the top becomes resonant.",
      "how": "Percuss from the midline out towards a flank until the note turns dull, keep your finger at that spot, ask the patient to roll away from you and wait 30 seconds, then percuss again. Normal: resonance throughout, with no change on turning. Pitfall: it needs at least about 1.5 litres of fluid, so small ascites can be missed.",
      "why": "Free fluid settles to the dependent flank and gas-filled bowel floats to the top, so the percussion note changes with position.",
      "media_slot": "sign:shifting-dullness",
      "brief": "FRAMING: the side of the abdomen only, with the examiner percussing over the flank; only the hands and the abdomen are in view. Middle finger of one hand tapped by the other, patient lying on one side. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "venous-hum",
      "name": "Venous hum or hepatic bruit",
      "method": "auscultation",
      "region": "abdomen",
      "scene_id": "abdomen",
      "what": "A soft continuous hum heard over the epigastrium or around the umbilicus. A harsh bruit over the liver raises the possibility of a hepatocellular carcinoma.",
      "how": "Place the diaphragm of the stethoscope over the epigastrium, the right upper quadrant and around the umbilicus and listen for a minute while the patient holds their breath. Normal: only intermittent bowel sounds. Pitfall: a venous hum is soft and easily missed in a noisy room.",
      "why": "Blood moves through large paraumbilical collaterals (the Cruveilhier-Baumgarten murmur) in portal hypertension. It is uncommon, but its presence strongly supports portal hypertension.",
      "media_slot": "sign:venous-hum",
      "brief": "FRAMING: the upper abdomen only, with a stethoscope chest piece held on the epigastrium by the examiner's hand. Only the hand, the stethoscope and the abdomen are in view. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     },
     {
      "id": "pitting-oedema",
      "name": "Pitting oedema",
      "method": "palpation",
      "region": "legs",
      "scene_id": "legs",
      "what": "Swelling of the ankles, shins and sometimes the thighs and sacrum that leaves a dent when pressed.",
      "how": "Press firmly with a thumb over the shin bone (tibia) or behind the medial malleolus for at least five seconds, then release and look for a dent. Note how high the swelling reaches and check the sacrum in a patient who is in bed. Normal: no dent. Pitfall: heart failure, kidney disease, venous disease and some drugs also cause oedema, so do not blame the liver without the other features.",
      "why": "Low albumin reduces the oncotic pressure, and sodium and water retention and raised pressure in the veins of the legs add to it, so fluid leaks into the tissues. It often follows the ascites.",
      "media_slot": "sign:pitting-oedema",
      "brief": "FRAMING: both lower legs and feet only, from just below the knees to the feet, resting on a couch, cropped at the knees. Visible swelling above both ankles and a clear thumb-print indentation in the skin over the shin. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows.",
      "compare": {
       "label": "Normal",
       "media": "sign:pitting-oedema-normal"
      }
     },
     {
      "id": "shin-bruising",
      "name": "Shin bruising",
      "method": "inspection",
      "region": "legs",
      "scene_id": "legs",
      "what": "Scattered small bruises of different ages over the shins, usually after minor knocks.",
      "how": "Expose both legs from the knees down and look at the shins and ankles in good light, comparing the two sides, then ask about easy bruising and bleeding from the gums. Normal: clear skin or a single bruise with a clear history. Pitfall: a bruise over a swollen shin can also come from oedema or a venous problem, so look at the skin as a whole.",
      "why": "Reduced clotting factor synthesis and a low platelet count from hypersplenism make the skin bruise after trivial injury, and tense oedema makes the shin skin fragile. It marks reduced synthetic function.",
      "media_slot": "sign:shin-bruising",
      "brief": "FRAMING: close-up of both shins and ankles only, from just below the knees to the feet, resting on a couch. Several small bruises of different ages over the shins. medium-brown skin, adult male, lean. Photorealistic clinical photograph, soft even clinical lighting, plain neutral background, landscape 4:3 framing, sharp focus on the finding. Do not show the face or any part of the body outside the frame. No text, no labels, no arrows."
     }
    ],
    "chain": [
     {
      "step": 1,
      "title": "Chronic liver injury",
      "body": "Years of alcohol excess, chronic hepatitis B or C, fatty liver disease, autoimmune or cholestatic disease, or a genetic disorder keep injuring the hepatocytes and keep the liver inflamed.",
      "media": "chain:1"
     },
     {
      "step": 2,
      "title": "Stellate cell activation and fibrosis",
      "body": "Persistent inflammation activates hepatic stellate cells, which lay down collagen, so scar tissue gradually replaces normal liver tissue.",
      "media": "chain:2"
     },
     {
      "step": 3,
      "title": "Nodular regeneration and distorted architecture",
      "body": "Scar bands surround islands of regenerating hepatocytes. The normal lobules and the fine blood channels between them are lost, and the liver becomes firm, nodular and, in time, small.",
      "media": "chain:3"
     },
     {
      "step": 4,
      "title": "Portal hypertension",
      "body": "The distorted liver resists portal flow, so pressure rises in the portal system. Blood finds collateral routes (oesophageal and gastric varices, paraumbilical veins) and the spleen enlarges.",
      "media": "chain:4"
     },
     {
      "step": 5,
      "title": "Splanchnic vasodilatation and fluid retention",
      "body": "Dilated splanchnic vessels reduce the effective arterial volume, so the kidneys retain sodium and water. With the portal pressure and a low albumin, fluid collects as ascites and oedema.",
      "media": "chain:5"
     },
     {
      "step": 6,
      "title": "Failing synthetic and metabolic function",
      "body": "Fewer working hepatocytes make less albumin and fewer clotting factors and clear bilirubin and oestrogen poorly, so patients become jaundiced, bruise easily and develop skin and hormonal stigmata and wasting.",
      "media": "chain:6"
     },
     {
      "step": 7,
      "title": "Hepatic encephalopathy",
      "body": "Ammonia and other toxins from the gut bypass the failing liver through portosystemic shunts and reach the brain, causing confusion, a flapping tremor and a reversed sleep pattern.",
      "media": "chain:7"
     }
    ],
    "investigations": [
     {
      "modality": "Full blood count",
      "findings": [
       "Low platelets from hypersplenism and marrow suppression; macrocytosis may point to alcohol or folate deficiency; anaemia has several causes, including bleeding and chronic disease."
      ]
     },
     {
      "modality": "Liver profile and albumin",
      "findings": [
       "Bilirubin is raised in decompensated disease; the aminotransferases may be only mildly raised or normal in advanced disease, and an AST to ALT ratio above 2 suggests alcohol.",
       "Albumin is low from reduced synthesis; ALP and GGT help show a cholestatic pattern or alcohol use."
      ]
     },
     {
      "modality": "Prothrombin time and INR",
      "findings": [
       "A prolonged PT and raised INR show impaired synthesis of clotting factors, which does not correct fully with vitamin K; also consider vitamin K deficiency and anticoagulants."
      ]
     },
     {
      "modality": "Urea, electrolytes and creatinine",
      "findings": [
       "Look for hyponatraemia and acute kidney injury (hepatorenal syndrome), and check potassium before and during diuretic treatment."
      ]
     },
     {
      "modality": "Diagnostic ascitic tap",
      "findings": [
       "A neutrophil count of 250 per mm³ or more means spontaneous bacterial peritonitis and needs antibiotics; send the fluid for culture in blood culture bottles at the bedside.",
       "A serum-ascites albumin gradient of 11 g/L (1.1 g/dL) or more points to portal hypertension; a total protein under 15 g/L marks a high risk of infection."
      ]
     },
     {
      "modality": "Ultrasound of the abdomen with Doppler",
      "findings": [
       "A small, nodular, echogenic liver, splenomegaly, ascites and an enlarged or reversed-flow portal vein; look for portal vein thrombosis.",
       "Repeat the ultrasound about every six months to screen for hepatocellular carcinoma, with or without alpha-fetoprotein."
      ]
     },
     {
      "modality": "Upper GI endoscopy",
      "findings": [
       "Look for oesophageal and gastric varices and portal hypertensive gastropathy; large varices need prevention of a first bleed."
      ]
     },
     {
      "modality": "Aetiology screen and fibrosis assessment",
      "findings": [
       "Test hepatitis B surface antigen and anti-HCV, ferritin and transferrin saturation, autoantibodies and immunoglobulins, and caeruloplasmin in younger patients.",
       "Elastography or a FIB-4 score estimates fibrosis in early disease, but a clinically obvious cirrhosis does not need staging."
      ]
     }
    ],
    "summary": {
     "keyPoints": [
      "Cirrhosis is irreversible scarring with nodular regeneration; its two consequences are portal hypertension and failing liver function.",
      "Decompensation means ascites, variceal bleeding, hepatic encephalopathy or jaundice, and each carries a worse prognosis.",
      "Examine in a set order: hands, face and eyes, chest, abdomen, then legs, and always look for asterixis.",
      "Confirm ascites by percussion (shifting dullness) and, for large volumes, a fluid thrill; inspection alone is not enough.",
      "Do a diagnostic paracentesis in every patient admitted with cirrhosis and ascites.",
      "Treat the cause, prevent the complications and screen for hepatocellular carcinoma every six months."
     ],
     "osceTips": [
      "Introduce yourself, wash your hands, gain consent, offer a chaperone, and keep the patient decently covered throughout.",
      "Say what you are looking for as you go, for example \"I am checking for asterixis\", so the examiner can give you the mark.",
      "Lie the patient at 45 degrees and expose from the nipples to the groin, with the groin covered.",
      "Palpate gently, watch the patient's face, and ask about tenderness before pressing deeper.",
      "Say \"chronic liver disease\" first, and name cirrhosis and decompensation only once you can support them with ascites, jaundice or encephalopathy.",
      "End by offering to check the temperature, a rectal examination and urinalysis, and name your first investigations."
     ],
     "connect": {
      "parotid-enlargement": 1,
      "dupuytren": 1,
      "liver-edge": 3,
      "caput-medusae": 4,
      "splenomegaly": 4,
      "venous-hum": 4,
      "ascites-distension": 5,
      "fluid-thrill": 5,
      "shifting-dullness": 5,
      "pitting-oedema": 5,
      "scleral-jaundice": 6,
      "temporal-wasting": 6,
      "palmar-erythema": 6,
      "leuconychia": 6,
      "forearm-bruising": 6,
      "shin-bruising": 6,
      "spider-naevi": 6,
      "gynaecomastia": 6,
      "body-hair-loss": 6,
      "asterixis": 7
     }
    },
    "treatment": [
     {
      "group": "Immediate assessment",
      "items": [
       "Check airway, breathing and circulation, observations and capillary glucose, and look for bleeding, sepsis, acute kidney injury and encephalopathy.",
       "Do a diagnostic ascitic tap in every patient admitted with ascites and send fluid for cell count, culture and albumin.",
       "Give thiamine before glucose in an alcohol-dependent patient, and assess the risk of alcohol withdrawal with a scale such as CIWA-Ar.",
       "Stop nephrotoxic drugs, including NSAIDs, and review all medicines."
      ]
     },
     {
      "group": "Treat the complications",
      "items": [
       "Ascites: moderate dietary sodium restriction (about 2 g of sodium a day) and spironolactone, adding furosemide as needed, with regular checks of sodium, potassium and creatinine; large-volume paracentesis with albumin for tense ascites.",
       "Spontaneous bacterial peritonitis: empirical intravenous antibiotics, such as a third-generation cephalosporin, with albumin in patients with raised creatinine or bilirubin, then secondary prophylaxis.",
       "Variceal bleeding: resuscitate cautiously, give a vasoactive drug such as terlipressin and antibiotic prophylaxis, and arrange endoscopy with band ligation within 12 hours.",
       "Hepatic encephalopathy: find and treat the trigger (infection, bleeding, constipation, sedatives, electrolytes), give lactulose, and add rifaximin to prevent recurrence.",
       "Hepatorenal syndrome: stop diuretics, give albumin and a vasoconstrictor such as terlipressin, and involve a specialist urgently."
      ]
     },
     {
      "group": "Treat the cause and prevent progression",
      "items": [
       "Alcohol: complete abstinence with counselling and support; hepatitis B or C: antiviral treatment; fatty liver: weight loss and control of diabetes; autoimmune or genetic disease: disease-specific treatment.",
       "Prevent a first variceal bleed in patients with large varices with a non-selective beta-blocker, such as carvedilol, or band ligation.",
       "Ensure adequate nutrition with a late-evening snack and about 1.2 to 1.5 g of protein per kg a day; do not restrict protein."
      ]
     },
     {
      "group": "Long-term care",
      "items": [
       "Screen for hepatocellular carcinoma with an ultrasound about every six months.",
       "Vaccinate against hepatitis A and B, influenza and pneumococcus, and avoid alcohol and unnecessary hepatotoxic drugs, including high-dose paracetamol.",
       "Refer for liver transplant assessment in decompensated disease, for example refractory ascites, a previous bleed or encephalopathy, once the patient is abstinent where relevant."
      ]
     }
    ],
    "related": [],
    "practice": {
     "checklist": [
      {
       "section": "Introduction and preparation",
       "items": [
        {
         "id": "lc-intro",
         "text": "Washes hands, introduces self, confirms the patient's name and age",
         "marks": 1
        },
        "Explains the examination, gains consent and offers a chaperone",
        "Positions the patient at 45 degrees on a flat couch with one pillow",
        "Exposes from the nipples to the groin while keeping the patient covered and comfortable",
        "Asks about pain before starting"
       ]
      },
      {
       "section": "General inspection and hands",
       "items": [
        "Inspects from the end of the bed for jaundice, muscle wasting, abdominal distension, bruising and confusion",
        "Inspects the nails for leuconychia and clubbing",
        "Looks at the palms for palmar erythema and for Dupuytren contracture",
        "Tests for asterixis with the arms stretched out and the wrists bent back",
        "Checks the forearms for bruising and purpura"
       ]
      },
      {
       "section": "Face and chest",
       "items": [
        "Inspects the sclerae for jaundice in natural light",
        "Looks for parotid enlargement and temporal wasting",
        "Inspects the upper chest and neck for spider naevi",
        "Inspects for gynaecomastia and for loss of chest and axillary hair"
       ]
      },
      {
       "section": "Abdomen: inspect and palpate",
       "items": [
        "Inspects for distension, bulging flanks, an everted umbilicus, striae, scars and dilated veins",
        "Looks for caput medusae and, if present, assesses the direction of flow",
        "Palpates all nine regions gently, watching the patient's face, and checks for tenderness",
        "Palpates for the liver edge from the right iliac fossa upwards, in time with breathing",
        "Palpates for the spleen from the right iliac fossa towards the left costal margin",
        "Attempts to elicit a fluid thrill if ascites is large"
       ]
      },
      {
       "section": "Abdomen: percuss and auscultate",
       "items": [
        "Percusses the liver span and the flanks",
        "Demonstrates shifting dullness correctly, waiting 30 seconds after the patient rolls",
        "Auscultates over the epigastrium and around the umbilicus for a venous hum, and over the liver for a bruit"
       ]
      },
      {
       "section": "Legs and completion",
       "items": [
        "Checks the ankles, shins and sacrum for pitting oedema",
        "Looks at the legs for bruising and muscle wasting",
        "Thanks the patient, covers them and washes hands",
        "Offers to complete the examination with temperature, rectal examination, urinalysis and hernial orifices",
        "Presents the findings clearly and suggests the first investigations"
       ]
      }
     ],
     "questions": [
      {
       "q": "What are the common causes of cirrhosis?",
       "a": "Alcohol-related liver disease, chronic hepatitis B and C, metabolic dysfunction-associated fatty liver disease, autoimmune and cholestatic diseases (autoimmune hepatitis, primary biliary cholangitis, primary sclerosing cholangitis) and genetic or metabolic causes such as haemochromatosis, Wilson disease and alpha-1 antitrypsin deficiency."
      },
      {
       "q": "How do you define decompensated cirrhosis?",
       "a": "Cirrhosis with a major complication: ascites, variceal bleeding, hepatic encephalopathy or jaundice. It carries a much worse prognosis than compensated disease and is an indication to consider liver transplantation."
      },
      {
       "q": "What is the pathophysiology of ascites in cirrhosis?",
       "a": "Portal hypertension and splanchnic vasodilatation reduce the effective arterial volume. The kidneys respond by retaining sodium and water through the renin-angiotensin-aldosterone system, and low albumin and raised hydrostatic pressure let the fluid collect in the peritoneal cavity."
      },
      {
       "q": "How would you confirm ascites at the bedside?",
       "a": "By percussion: shifting dullness, with a fluid thrill in large ascites. Ultrasound confirms smaller volumes. Inspection alone is not enough because obesity and bowel obstruction also distend the abdomen."
      },
      {
       "q": "What is the first test in a patient admitted with cirrhosis and ascites?",
       "a": "A diagnostic paracentesis. Send the fluid for a neutrophil count, culture in blood culture bottles, total protein and albumin, and calculate the serum-ascites albumin gradient. A neutrophil count of 250 per mm³ or more means spontaneous bacterial peritonitis."
      },
      {
       "q": "What is the serum-ascites albumin gradient?",
       "a": "The serum albumin minus the ascitic fluid albumin on the same day. A gradient of 11 g/L (1.1 g/dL) or more indicates portal hypertension, as in cirrhosis, and a lower gradient points to causes such as peritoneal malignancy or tuberculosis."
      },
      {
       "q": "How do you manage a patient with variceal bleeding?",
       "a": "Resuscitate with a restrictive transfusion strategy, give a vasoactive drug such as terlipressin, start antibiotic prophylaxis, and arrange urgent endoscopy with band ligation. Use a transjugular intrahepatic portosystemic shunt (TIPS) for bleeding that is not controlled or that recurs, and begin secondary prevention."
      },
      {
       "q": "What precipitates hepatic encephalopathy and how is it treated?",
       "a": "Triggers include infection, gastrointestinal bleeding, constipation, dehydration, electrolyte disturbance, sedatives and a high protein load. Treat the trigger, give lactulose, and add rifaximin to prevent recurrence."
      },
      {
       "q": "Which patients with cirrhosis are screened for hepatocellular carcinoma, and how?",
       "a": "All patients with cirrhosis, with an ultrasound about every six months, with or without alpha-fetoprotein. A new mass or a rise in alpha-fetoprotein needs cross-sectional imaging."
      },
      {
       "q": "What are the complications of cirrhosis?",
       "a": "Ascites, spontaneous bacterial peritonitis, variceal bleeding, hepatic encephalopathy, hepatorenal syndrome, coagulopathy and bleeding, hepatopulmonary syndrome, malnutrition and hepatocellular carcinoma."
      }
     ]
    }
   }
  }
 ]
}
```

**LONG case sample. A real case has all 7 sections with 5 to 9 exchanges each, 4 to 6 differentials and 6 to 10 viva questions:**

```json
{
  "format_id": "osce.bulk-import",
  "format_version": "1.0.0",
  "import_options": {
    "create_as_draft": true
  },
  "cases": [
    {
      "slug": "liver-cirrhosis-history-long",
      "title": "Decompensated Liver Cirrhosis — History Long Case",
      "summary": "A 52-year-old three-wheeler driver with abdominal swelling, leg oedema and jaundice, with a long alcohol history.",
      "station_type": "long",
      "difficulty": "intermediate",
      "course_ref": "MBBS_MEDICINE",
      "topic_ref": "GASTROENTEROLOGY",
      "is_public": false,
      "is_free": false,
      "case_data": {
        "version": 1,
        "stationType": "long",
        "scenes": [],
        "signs": [],
        "chain": [],
        "investigations": [],
        "sounds": [],
        "patient": {
          "name": "Nimal",
          "age": 52,
          "sex": "male",
          "occupation": "Three-wheeler driver",
          "opening": "Doctor, my belly keeps getting bigger and my eyes have turned yellow."
        },
        "sections": [
          {
            "id": "introduction",
            "title": "Introduction",
            "purpose": "Introduce yourself, confirm identity, get consent and open the consultation.",
            "exchanges": [
              {
                "ask": "Good morning. I'm one of the doctors on the ward. Could I confirm your name and age, please?",
                "reply": "I'm Nimal Perera, I'm fifty-two.",
                "note": ""
              },
              {
                "ask": "Thank you, Mr Perera. I'd like to ask you some questions about why you came in and then examine you. Is that all right?",
                "reply": "Yes, doctor, that's fine.",
                "note": ""
              }
            ]
          },
          {
            "id": "presenting-complaint",
            "title": "Presenting complaint",
            "purpose": "Characterise each symptom: onset, progression, associated features, and what has made it better or worse.",
            "exchanges": [
              {
                "ask": "Tell me about the swelling of your belly. When did you first notice it?",
                "reply": "About two months ago. My trousers got tight, and it has slowly grown since.",
                "note": ""
              },
              {
                "ask": "Is it painful?",
                "reply": "Only a dull heaviness. It is not sharp pain, but it makes me breathless when I lie flat.",
                "note": ""
              }
            ]
          },
          {
            "id": "systemic-review",
            "title": "Systemic review",
            "purpose": "Screen other systems and look for complications of liver disease and its causes.",
            "exchanges": [
              {
                "ask": "Have you lost weight or lost your appetite?",
                "reply": "I have lost my appetite. My arms and legs look thin even though the belly is large.",
                "note": ""
              },
              {
                "ask": "Any shortness of breath on walking, chest pain or palpitations?",
                "reply": "A bit breathless on stairs. No chest pain.",
                "note": ""
              }
            ]
          }
        ],
        "differentials": [
          {
            "diagnosis": "Alcohol-related cirrhosis with decompensation",
            "supporting": "Twenty years of heavy drinking, ascites, oedema, jaundice, gynaecomastia and day-night reversal.",
            "against": "Other causes can coexist, and alcohol hepatitis could sit on top of cirrhosis."
          },
          {
            "diagnosis": "Chronic viral hepatitis (B or C) with cirrhosis",
            "supporting": "A family history of a 'yellow illness' and no vaccination; viral and alcohol injury often coexist.",
            "against": "No transfusion, tattoos or injections reported."
          }
        ],
        "initialManagement": [
          "Assess airway, breathing and circulation, check glucose and look for bleeding or sepsis.",
          "Do a diagnostic ascitic tap and send liver tests, clotting, FBC, U&E and cultures."
        ],
        "treatment": [
          {
            "group": "Immediate",
            "items": [
              "Resuscitate and treat any bleeding or infection; give antibiotics for spontaneous bacterial peritonitis.",
              "Thiamine, and a withdrawal scale such as CIWA with benzodiazepines if needed.",
              "Lactulose for encephalopathy."
            ]
          },
          {
            "group": "Definitive",
            "items": [
              "Sodium restriction and spironolactone with a loop diuretic; therapeutic paracentesis with albumin for tense ascites.",
              "Endoscopic screening for varices and non-selective beta-blocker or band ligation.",
              "Treat the cause: complete alcohol abstinence and support."
            ]
          }
        ],
        "summary": {
          "keyPoints": [
            "Ascites, jaundice and encephalopathy mark decompensation.",
            "Take a quantified, non-judgemental alcohol history."
          ],
          "osceTips": [
            "Open with the patient's own words and clarify each symptom."
          ],
          "connect": []
        },
        "related": [],
        "practice": {
          "checklist": [
            {
              "section": "Introduction",
              "items": [
                "Introduces self, confirms identity and obtains consent",
                "Asks the patient to describe the problem in their own words"
              ]
            },
            {
              "section": "Presenting complaint",
              "items": [
                "Characterises the abdominal swelling and leg swelling",
                "Asks about jaundice, dark urine, itching and stool colour",
                "Asks about haematemesis, melaena and confusion"
              ]
            }
          ],
          "questions": [
            {
              "q": "What features suggest this patient is decompensated?",
              "a": "Ascites, jaundice and encephalopathy, and a history of variceal bleeding if present."
            }
          ]
        }
      }
    }
  ]
}
```

### 2. Plan the clinical coverage FIRST, then write `case.json`

The samples above are tiny on purpose. A real station is a COMPLETE examination of the system,
the way an examiner would mark it. Do not write a thin case.

**Step A: write `coverage.md` before anything else.** For the condition, list every classical
sign an examiner expects, grouped by region and by technique, with one line each on why it is or
is not in this case. Use this region guide to decide the regions:

| System of the condition | Regions to cover (use the ones that apply) |
|---|---|
| Abdomen / liver / GI | hands, face and eyes, neck, chest (skin), abdomen, **legs** |
| Cardiovascular | hands and pulse, face, neck (JVP), praecordium, abdomen (liver), **legs** |
| Respiratory | hands, face, neck, chest (front and back), **legs** |
| Neurological | face, upper limbs, lower limbs, gait |
| Endocrine / thyroid | hands, face and eyes, neck, legs |
| Renal / other | hands, face, abdomen, **legs**, general |

Rules for the coverage plan:
- Every region an examiner would look at must be in the case, **including the legs whenever
  oedema, bruising, ulcers, neuropathy or muscle wasting could be present** (for liver and heart
  disease that means pitting oedema).
- Every technique that is really used must appear. An abdominal case needs Look, Feel (palpation
  of liver, spleen, kidneys, masses, tenderness), Percuss (liver span, shifting dullness) and, where
  relevant, Listen. A cardiac case needs Look, Feel and Listen. Do not leave a technique empty.
- Observations the examiner measures are findings too and get a technique picture: pulse, blood
  pressure (cuff on the arm), oxygen saturation (oximeter on a finger) and respiratory rate. Place
  them on the hands region, or on the chest region for breathing. Also cover central cyanosis at
  the tongue (head region) and general appearance wherever the condition affects them. A cardiac or
  respiratory case without blood pressure and oxygen saturation is incomplete.
- Negatives and normal comparisons are NOT findings. Put a normal finding in the `how` text as
  "Normal: ...", or as a `-normal` comparison picture. See rule 4 below.
- Anything you leave out must be listed with a reason (for example "not expected in this
  condition"). Do not silently skip classical signs.

**Step B: write `case.json` to match the coverage plan.**

A package with one case, in the same wrapper as the samples
(`format_id: "osce.bulk-import"`, `import_options.create_as_draft: true`, `cases: [ ... ]`).

**Short case (examination-led): minimum content**
- `scenes`: the `body` scene (the whole patient) plus 5 to 8 REGION scenes. Exactly two levels:
  the body's hotspots open regions (`target_type: "scene"`), each region's hotspots open findings
  (`target_type: "sign"`). Never nest a region inside another region. Every region from the
  coverage plan gets its own scene, and every region scene has at least 2 hotspots. Coordinates
  `x` and `y` are fractions from 0 to 1; they are a first guess that a human will drag into place.
- `signs` (findings): **16 to 24**, covering every region and every technique in the coverage
  plan. Each has `id`, `name`, `method` (`inspection` = Look, `palpation` = Feel, `percussion` =
  Percuss, `auscultation` = Listen, `symptom` = Ask), `region` (one of head, neck, chest,
  abdomen, groin, hands, legs, general), `scene_id`, `what` (the finding, 1 to 2 sentences), `how`
  (patient position, landmarks, which hand or stethoscope, what to do, 1 to 3 sentences), `why`
  (the mechanism), `media_slot` (`sign:<id>`) and `brief` (a purely visual description; leave it
  empty for something that cannot be seen, such as a murmur or percussion note).
  Each region must hold at least 1 finding, and most regions 2 or more.
- `chain`: 5 to 8 numbered mechanism steps, each with `media: "chain:<n>"`.
- `summary.connect`: a map of finding id to the mechanism step that explains it. Cover EVERY
  finding a step accounts for, not just a few. Every id and step number must exist.
- `investigations`: 6 to 10 real tests with short findings. State the standard diagnostic
  thresholds and criteria that examiners ask for (for example the peritonitis cell-count cut-off),
  but never invent a patient's numeric results.
- `treatment`: 3 or 4 groups (Immediate assessment, Treat the complications, Treat the cause,
  Long-term care), each with at least 3 specific, guideline-style steps.
- `practice.checklist`: 5 to 7 sections, each with at least 3 items and most with 5 or more, written
  in the order of the real exam. `practice.questions`: 8 to 12 viva questions with model answers.
- `summary.keyPoints` (5 to 8) and `summary.osceTips` (5 to 8).
- Do NOT write `sounds`. Recordings are attached by hand from the Auscultation library.

**Depth of each finding (this is where thin cases fail)**
- `what`: 2 to 3 sentences. Say what it looks like or feels like, how big or how many counts
  (for example "five or more spider naevi", "bilirubin about 40 µmol/L"), and which side or where.
- `how`: 3 to 5 sentences, in order: patient position and light, landmarks, what you do with your
  hands or stethoscope, then end with **"Normal: ..."** (what a normal finding looks like) and
  **"Pitfall: ..."** (the common mistake or look-alike). The student must be able to perform it
  from this text alone.
- `why`: 2 to 3 sentences on the mechanism, then what it means clinically (how specific it is,
  what it says about severity or the cause).
- Write the way an examiner would mark it. Use real numbers and standard cut-offs where they exist.

**Normal comparison pictures.** For 4 to 6 findings where seeing the normal teaches the sign
(palms, nails, sclerae, the contour of the abdomen, the legs), add to the finding
`"compare": { "label": "Normal", "media": "sign:<finding-id>-normal" }`. The importer keeps it and
the app shows the normal picture beside the abnormal one. These are extra picture slots.

**Consistency rules (the case fails review if any is broken)**
1. Every sign or manoeuvre named in the checklist, the tips or the viva must exist as a finding
   (general steps such as introduction, consent, hand hygiene and covering the patient are the only
   exceptions). If the checklist says "tests for asterixis", there must be an asterixis finding.
2. Every finding is placed on a region scene and reachable from a hotspot.
3. The picture briefs must agree with the findings and with each other. If the findings say
   tense ascites, every brief that shows the abdomen shows it. One patient, one severity.
4. Every finding is PRESENT in this patient. Never write a finding whose text says a sign is
   absent, "not present in this case" or "no ... seen". There is nothing to photograph and it
   teaches nothing. Absence belongs in the `how` text as "Normal: ...", in the checklist, or in
   the viva.
5. No finding may use `"scene_id": "body"`. The body picture only opens regions, so a finding on
   it can never be reached. Put general observations (breathlessness, general inspection) on the
   nearest region scene.
6. Hotspots: every hotspot gets its OWN believable position on its region picture, spread to
   where the finding would be seen. NEVER leave several hotspots at the same place (for example
   all at x 0.5, y 0.5). A human will fine-tune them, but they must start apart. Never point two
   hotspots at the same finding.
7. `summary.connect` only where the mechanism truly explains the sign. Leave a sign out rather
   than invent a link (for example a scar or a pale conjunctiva is not explained by a mechanism
   step, so do not connect it just to fill the list).
8. Internal consistency: findings, mechanism and treatment must agree (for example do not describe
   warm hands in a case whose mechanism is low cardiac output).
9. Do not cite a guideline by name and year, or quote specific cut-offs, unless you are certain
   they are correct. Otherwise write "current local guidance". Never invent a patient's results.

**Long case (history-led)**: follow the long sample, but complete: a `patient` with opening words,
all 7 `sections` of question-and-answer exchanges in the patient's own lay language (5 to 9
exchanges each, with relevant negatives), 4 to 6 `differentials` (each with for and against),
`initialManagement`, `treatment` (3 groups), `summary`, and a `practice` checklist (4 to 6 sections)
with 6 to 10 viva questions. Long cases use two shared pictures for the whole app, so they need NO
pictures of their own. Skip sections 3 and 4 below for a long case, and write `coverage.md` as a
list of the history areas an examiner expects for this condition.

Clinical rules: be exam-accurate and specific; no real patient data; mark nothing as reviewed.
A clinician will check it before it is published.

**Slug.** Use a kebab-case slug of the condition plus `-short` or `-long`, for example
`liver-cirrhosis-short`. State the slug in your reply so it can be checked against existing cases.

### 3. Pictures (short cases)

Create the files in `docs/osce/cases/<slug>/images/`.

**File names.** Take the slot key and replace `:` with `-`:
`scene:body` becomes `scene-body.jpg`, `scene:abdomen` becomes `scene-abdomen.jpg`,
`sign:shifting-dullness` becomes `sign-shifting-dullness.jpg`, `sign:palmar-erythema-normal` becomes
`sign-palmar-erythema-normal.jpg`, `chain:2` becomes `chain-2.jpg`.
Use `.jpg`, `.png` or `.webp`. Each file must be under 6 MB.

**Aspect ratios. This matters, the app frames every picture to these.**

| Slot | Ratio | Pixels |
|---|---|---|
| `scene:body` (the whole patient) | 3:4 portrait | 1536 x 2048 |
| everything else (region scenes, findings, mechanism steps) | 4:3 landscape | 1536 x 1152 |

**Which pictures to make. Aim for a full set, about 35 to 45 for a case this size.**
1. SCENES, required: `scene:body` and every region scene.
2. One picture for EVERY finding that can be seen (`sign:<id>`).
3. A TECHNIQUE photo for each Feel, Percuss and Listen finding: the examiner's hands (or the
   stethoscope) at the right landmark on the same patient, correctly positioned, patient draped,
   only the hands and the relevant body part in view. Use these instead of leaving a brief empty.
4. Every NORMAL comparison picture declared with `compare` (`sign:<id>-normal`).
5. One simple mechanism illustration for each step in `chain` (`chain:<n>`).
Only the scene pictures are required for publishing; the rest are optional in the app, but make
them all unless a picture cannot be made well, in which case use section 4.

**Picture briefs: FRAME THE SHOT FIRST. This is the most common reason a picture comes out wrong.**

An image model draws whatever the prompt talks about most. If a finding's prompt describes the
whole patient and the whole illness, you get a full-length picture of the patient, not the close-up
you wanted. So write each brief as a camera instruction about ONE crop:

1. **FRAMING** (first, always): exactly what is in the frame and what is cropped out.
2. **The finding as seen**: colour, size, number, distribution, in plain visual words.
3. **Identity cues for this crop only**: skin tone, age and sex. Not the disease, not the other
   findings, not the hair and gown unless they are in the frame.
4. **Style**: photorealistic clinical photograph, soft even light, plain neutral background, 4:3.
5. **Exclusions**: "Do not show the face or any part of the body outside the frame", plus no text.

Do NOT paste the patient bible, or a list of the case's other findings, into a finding's brief.
The patient bible is for `scene:body` only. The face, hands, abdomen and legs still match because
you repeat the same skin tone and age cues, and the disease stage lives in the findings.

Crop guide (the frame for each kind of picture):

| Slot | What is in the frame |
|---|---|
| `scene:body` | the ONLY full-length patient picture |
| region scene | that region only: hands and forearms; head and upper neck; chest from collarbones to lower ribs; abdomen from lower ribs to pelvis; both lower legs and feet from just below the knees |
| eye, nail, palm or skin sign | extreme close-up of that part only |
| Feel, Percuss, Listen finding | close-up of the examiner's hand or the stethoscope on the right landmark; only the hand and that body part in view |
| `-normal` comparison | the SAME framing and pose as its abnormal picture, with a normal finding |
| `chain:<n>` | a simple illustration, no patient |

Bad and good, for pitting oedema:
- BAD (gives a full patient): "Photorealistic clinical view of the same 63-year-old man, average
  build, grey hair, pale-blue gown, with breathlessness, raised JVP and 2+ pitting ankle oedema."
- GOOD: "FRAMING: both lower legs and feet only, from just below the knees to the feet, resting on a
  couch, cropped at the knees. Visible swelling above both ankles and a clear thumb-print
  indentation in the skin over the shin. Medium-brown skin, adult male, lean. Photorealistic
  clinical photograph, soft even light, plain neutral background, 4:3. Do not show the face or any
  part of the body outside the frame. No text, labels or arrows."

After each picture is made, OPEN it and check the framing against the brief before moving on. If
it shows a whole patient, the wrong region or extra body parts, regenerate it with a stronger crop
(name the crop edges, say "cropped at the knees", "macro close-up", "camera at shin height") and
put the exclusions first. Do not keep a picture that fails the framing check.

**Look of the photographs**
- Photorealistic clinical photography, soft even clinical lighting, neutral background.
  Natural skin texture and natural skin tones.
- ONE patient across the whole case. Before drawing anything, write a "patient bible" at the top of
  `image-prompts.md`: age, sex, build, skin tone, hair, gown, room and the severity of the disease.
  Use the full bible only for `scene:body`. In every other prompt use only the short identity cues
  that are visible in that crop (skin tone, age, sex), so the same person appears in every picture
  without the prompt pulling the whole patient into the frame.
- No text, no letters, no numbers, no labels, no arrows, no watermarks, no borders, no hotspot
  dots. The app draws its own markers.
- Show only what the eye would really see. Do not draw the mechanism or the diagnosis into a
  clinical photo.
- Keep patients decently draped. For breast, genital or other intimate examinations, do NOT
  generate nudity. Use a draped view, or fall back to step 4 and use a properly licensed
  medical image instead.
- Mechanism pictures (`chain:<n>`): clean, simple educational illustrations, one idea each, no text.

Write one prompt per picture into `image-prompts.md` (slot, file name, ratio, the exact prompt
used), so any picture can be regenerated later.

### 4. If you cannot make a believable clinical image, fetch a real one

Some things image models draw badly or wrongly: ECG tracings, chest films, echo frames,
ultrasound, histology, rare skin or eye signs. NEVER generate these and NEVER pass a drawing off
as the real thing. Instead, in this order:

1. Generate it, only if you are confident it is anatomically and clinically correct.
2. Otherwise search for a real image under an open licence (CC0, public domain or CC-BY),
   preferably Wikimedia Commons or Open-i (NIH). Download it, crop and resize to the slot's
   ratio, and save it with the correct file name. Do not use an image that needs a licence you
   cannot meet, and do not scrape a site that forbids reuse.
3. If neither works, leave the slot empty and list it in `missing-images.md`. Never put a
   placeholder or a wrong image in its place.

Every fetched image gets a line in `credits.md`: slot, file name, source page URL, author,
licence, and the date. Keep the required attribution wording exactly as the licence states.
Never use an image of an identifiable real patient unless the licence page says consent is
documented.

After saving each image, OPEN it and look at it. Confirm the ratio, that it shows the intended
finding, that there is no text on it, and that it matches the other pictures in the case. Show
each picture to me as you finish it.

### 5. Check your own work

Before you finish, verify and report the result of each. Then do the full FINAL REVIEW in
section 7, which you must repeat every single time:
- `case.json` is valid JSON and has one case with a unique slug.
- Every hotspot `x` and `y` is between 0 and 1. Every `target_id` exists.
- Every `summary.connect` key is a finding id and every value is a mechanism step that exists.
- Every `media_slot` and `slot_key` has a matching file in `images/`, or is listed in
  `missing-images.md` (allowed only for optional slots).
- Every image is the right ratio and under 6 MB, with no text on it.
- The scene pictures (the required ones) all exist.
- Coverage: every region and technique in `coverage.md` appears in the case, every region scene
  has at least 2 hotspots, and there are 16 to 24 findings, including the legs where they apply, and every finding
  has a `how` that ends with "Normal:" and "Pitfall:".
- Consistency: every sign named in the checklist, tips and viva exists as a finding, and the
  briefs agree with each other.
- Rules 4 to 9 above hold: no finding describes an absent sign, none sits on the body scene, no
  two hotspots share a position, and every `connect` link is a real mechanism.
- Framing: every picture shows only its own crop. Only `scene:body` shows the whole patient.
- At least 4 findings carry a `compare` normal picture.

### 6. Deliver

```
docs/osce/cases/<slug>/
  coverage.md        (written FIRST: expected signs by region and technique)
  case.json
  images/            (named as in section 3)
  image-prompts.md
  credits.md         (only if you fetched any images)
  missing-images.md  (only if any are missing)
  validate_case.py   (the checker from section 7, with its last output)
  review-log.md      (what each review pass found and fixed)
  README.md          (3 lines: what the case is, what is missing, what needs clinical review)
```

In your final reply, print the full `case.json` in one code block, then show every picture (or list
the ones that are missing). Do not commit, and do not touch any other file in the repository.

### 7. FINAL REVIEW: do this every time, before you reply

Do not trust your first draft. After you have written the case and made the pictures, review
everything and fix what you find. Repeat the whole review until a complete pass finds nothing
new. One pass is not enough.

**Pass A, run the checker.** Save the script below as `docs/osce/cases/<slug>/validate_case.py`
and run `python3 validate_case.py case.json images`. Fix every ERROR. For every WARN either fix
it or write one line in `review-log.md` explaining why it is acceptable. Run it again until it
prints `0 error(s)`.

**Pass B, read it as an examiner.** The checker cannot judge medicine. Re-read the whole case and
ask, for each part:
- Are all facts, numbers and cut-offs correct and current? No invented results? No guideline
  name or year you are not sure of?
- Does anything contradict anything else (a finding against the mechanism, the checklist against
  the findings, the treatment against the diagnosis, one picture brief against another)?
- Is every sign a student is told to look for in the checklist, tips or viva actually a finding?
- Is every region an examiner would visit present, including the legs, and every technique used?
- Does every finding really occur in THIS patient, with its negatives only inside "Normal:"?
- Would a student be able to perform each manoeuvre from the `how` text alone?
- Are the treatment steps safe, specific and in a sensible order?

**Pass C, look at every picture again.** Open each one. Is it the right crop (only the
scene:body picture shows the whole patient)? Is the finding clearly visible? Is it the same
person as the others? Is the ratio right? No text, labels or watermark? Decently draped? Does the
anatomy look correct (hands, fingers, legs, feet)? Regenerate or replace any that fail.

**Then repeat A, B and C.** Stop only when a full pass finds nothing to change.

**Report.** Write `review-log.md`: for each pass, what you found and what you fixed, then what is
left for a clinician. Copy the final `0 error(s)` line of the checker into it. In your reply say
how many passes you needed.

The checker (save exactly as `validate_case.py`; needs only Python 3, and Pillow for the picture
ratio check):

```python
#!/usr/bin/env python3
"""Check an OSCE case package. Usage: python3 validate_case.py case.json [images_dir]
Prints ERROR lines (must fix) and WARN lines (review). Exit code 1 if any ERROR."""
import json, os, re, sys

path = sys.argv[1]
img_dir = sys.argv[2] if len(sys.argv) > 2 else None
errors, warns = [], []
E = lambda m: errors.append(m)
W = lambda m: warns.append(m)

try:
    pkg = json.load(open(path, encoding='utf-8'))
except Exception as ex:
    print('ERROR: not valid JSON:', ex); sys.exit(1)

cases = pkg.get('cases') or []
if len(cases) != 1:
    E(f'expected exactly 1 case, found {len(cases)}')
c = cases[0] if cases else {}
doc = c.get('case_data') or {}
slug = c.get('slug', '')
if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', slug):
    E(f'slug "{slug}" must be lower-case kebab-case')
stype = c.get('station_type')
if stype not in ('short', 'long'):
    E('station_type must be short or long')
if c.get('difficulty') not in ('core', 'intermediate', 'advanced'):
    E('difficulty must be core, intermediate or advanced')

def count(name, items, lo, hi):
    n = len(items)
    if n < lo or n > hi:
        W(f'{name}: {n} (expected {lo} to {hi})')

ABSENT = re.compile(r"\b(no [a-z\- ]{0,30}(is|are|was|were) (seen|present|found|visible)|not present|is absent|are absent|there is no|there are no|without (any )?(obvious|gross|convincing)|no convincing|in this teaching case|not expected in this)\b", re.I)

if stype == 'long':
    secs = doc.get('sections') or []
    count('history sections', secs, 7, 9)
    for s in secs:
        count(f'exchanges in "{s.get("title")}"', s.get('exchanges') or [], 4, 10)
    count('differentials', doc.get('differentials') or [], 4, 6)
    count('viva questions', (doc.get('practice') or {}).get('questions') or [], 6, 12)
    count('checklist sections', (doc.get('practice') or {}).get('checklist') or [], 4, 7)
else:
    scenes = doc.get('scenes') or []
    signs = doc.get('signs') or []
    chain = doc.get('chain') or []
    sids = [s.get('id') for s in scenes]
    gids = [s.get('id') for s in signs]
    for label, ids in (('scene', sids), ('finding', gids)):
        dup = {i for i in ids if ids.count(i) > 1}
        if dup: E(f'duplicate {label} ids: {sorted(dup)}')
    if 'body' not in sids: E('there is no "body" scene')
    count('region scenes', [s for s in scenes if s.get('id') != 'body'], 5, 8)
    count('findings', signs, 16, 24)
    count('mechanism steps', chain, 5, 8)
    count('investigations', doc.get('investigations') or [], 6, 10)
    count('treatment groups', doc.get('treatment') or [], 3, 4)
    pr = doc.get('practice') or {}
    count('checklist sections', pr.get('checklist') or [], 5, 7)
    count('viva questions', pr.get('questions') or [], 8, 12)
    sm = doc.get('summary') or {}
    count('keyPoints', sm.get('keyPoints') or [], 5, 8)
    count('osceTips', sm.get('osceTips') or [], 5, 8)
    if doc.get('sounds'): E('"sounds" must be empty; recordings are attached by hand')

    reach = {}
    for sc in scenes:
        sid = sc.get('id')
        if sc.get('slot_key') != f'scene:{sid}': E(f'scene {sid}: slot_key should be scene:{sid}')
        hs = sc.get('hotspots') or []
        if sid != 'body' and len(hs) < 2: W(f'scene {sid}: only {len(hs)} hotspot(s); region scenes need 2 or more')
        seen_t = set()
        for i, h in enumerate(hs):
            x, y = h.get('x'), h.get('y')
            if not (isinstance(x, (int, float)) and isinstance(y, (int, float)) and 0 <= x <= 1 and 0 <= y <= 1):
                E(f'scene {sid} hotspot {i}: x,y must be numbers from 0 to 1 (got {x},{y})')
            tt, tid = h.get('target_type'), h.get('target_id')
            if tt == 'scene':
                if tid not in sids: E(f'scene {sid} hotspot "{h.get("label")}" targets missing scene {tid}')
                if sid != 'body': E(f'scene {sid}: only the body scene may open a region')
            elif tt == 'sign':
                if tid not in gids: E(f'scene {sid} hotspot "{h.get("label")}" targets missing finding {tid}')
                if sid == 'body': E('the body scene may only open regions, not findings')
                reach[tid] = reach.get(tid, 0) + 1
            else:
                E(f'scene {sid} hotspot {i}: bad target_type {tt}')
            if (tt, tid) in seen_t: E(f'scene {sid}: two hotspots point at {tid}')
            seen_t.add((tt, tid))
        stacked = []
        for a in range(len(hs)):
            for b in range(a + 1, len(hs)):
                try:
                    if abs(hs[a]['x'] - hs[b]['x']) < 0.04 and abs(hs[a]['y'] - hs[b]['y']) < 0.04:
                        stacked.append((hs[a].get('label'), hs[b].get('label')))
                except Exception:
                    pass
        if stacked:
            E(f'scene {sid}: {len(stacked)} pair(s) of hotspots are stacked at the same place, for example "{stacked[0][0]}" and "{stacked[0][1]}". Spread them out')
        brief = sc.get('brief', '')
        if sid != 'body' and not brief.startswith('FRAMING:'): W(f'scene {sid}: brief should start with "FRAMING:"')
        if sid != 'body' and re.search(r'full[- ]length|full patient|whole patient', brief, re.I): E(f'scene {sid}: brief asks for the whole patient; only scene:body may')

    sign_scene = {}
    for sg in signs:
        i = sg.get('id')
        if sg.get('scene_id') == 'body' or sg.get('scene_id') not in sids: E(f'finding {i}: scene_id "{sg.get("scene_id")}" must be a REGION scene, never body')
        if i not in reach: E(f'finding {i} is not reachable from any hotspot')
        if sg.get('media_slot') != f'sign:{i}': E(f'finding {i}: media_slot should be sign:{i}')
        if sg.get('method') not in ('inspection', 'palpation', 'percussion', 'auscultation', 'symptom'): E(f'finding {i}: bad method')
        if sg.get('region') not in ('head', 'neck', 'chest', 'abdomen', 'groin', 'hands', 'legs', 'general'): E(f'finding {i}: bad region')
        for k in ('what', 'how', 'why'):
            if not str(sg.get(k, '')).strip(): E(f'finding {i}: {k} is empty')
        how = str(sg.get('how', ''))
        if 'Normal:' not in how or 'Pitfall:' not in how: W(f'finding {i}: "how" should contain "Normal:" and "Pitfall:"')
        if ABSENT.search(str(sg.get('what', '')) + ' ' + how[:200]): E(f'finding {i}: text says the sign is ABSENT; every finding must be present in this patient')
        b = sg.get('brief', '')
        if b and not b.startswith('FRAMING:'): W(f'finding {i}: brief should start with "FRAMING:"')
        if b and re.search(r'full[- ]length|whole patient|same \d+-year-old', b, re.I): E(f'finding {i}: brief pulls in the whole patient; describe only the crop')
        if sg.get('compare') and sg['compare'].get('media') != f'sign:{i}-normal': E(f'finding {i}: compare.media should be sign:{i}-normal')
    if sum(1 for s in signs if s.get('compare')) < 4: W('fewer than 4 findings have a "compare" normal picture')
    techs = {s.get('method') for s in signs}
    for t in ('inspection', 'palpation'):
        if t not in techs: W(f'no {t} findings at all')
    regs = {s.get('region') for s in signs}
    if 'legs' not in regs: W('no findings in the legs region; check whether oedema, bruising or wasting apply')

    steps = [s.get('step') for s in chain]
    if steps != list(range(1, len(chain) + 1)): E(f'chain steps must be 1..{len(chain)} in order, got {steps}')
    for s in chain:
        if s.get('media') != f'chain:{s.get("step")}': E(f'chain step {s.get("step")}: media should be chain:{s.get("step")}')
    con = sm.get('connect') or {}
    if isinstance(con, dict):
        for k, v in con.items():
            if k not in gids: E(f'connect: unknown finding {k}')
            if v not in steps: E(f'connect: {k} points at missing step {v}')
        miss = [g for g in gids if g not in con]
        if miss: W(f'findings with no mechanism link (fine only if no step really explains them): {miss}')
    else:
        E('summary.connect must be an object of finding id to step number')

    # checklist / tips / viva mention signs that must exist
    text = ' '.join(json.dumps(pr.get('checklist') or []).lower().split())
    for kw in ('asterixis', 'spider naevi', 'clubbing', 'jvp', 'oedema', 'splenomegaly', 'hepatomegaly', 'apex', 'heave', 'murmur', 'crackles', 'caput', 'ascites', 'jaundice'):
        if kw in text and not any(kw.split()[0] in (s.get('name', '') + s.get('id', '')).lower() for s in signs):
            W(f'the checklist mentions "{kw}" but no finding is named for it')

    # pictures
    if img_dir:
        slots = {sc.get('slot_key') for sc in scenes} | {s.get('media_slot') for s in signs} | {s.get('media') for s in chain}
        slots |= {s['compare']['media'] for s in signs if s.get('compare')}
        slots = {x for x in slots if x}
        have = {}
        for f in os.listdir(img_dir) if os.path.isdir(img_dir) else []:
            stem, ext = os.path.splitext(f)
            if ext.lower() in ('.jpg', '.jpeg', '.png', '.webp'): have[stem] = os.path.join(img_dir, f)
        try:
            from PIL import Image
        except Exception:
            Image = None; W('Pillow not installed: image ratio check skipped (pip install pillow)')
        for slot in sorted(slots):
            stem = slot.replace(':', '-')
            if stem not in have:
                (E if slot.startswith('scene:') else W)(f'missing picture for {slot} (expected {stem}.jpg/.png/.webp)'); continue
            fp = have[stem]
            if os.path.getsize(fp) > 6 * 1024 * 1024: E(f'{stem}: larger than 6 MB')
            if Image:
                w, h = Image.open(fp).size
                want = 3 / 4 if slot == 'scene:body' else 4 / 3
                if abs(w / h - want) > 0.03: E(f'{stem}: ratio {w}x{h} is wrong (want {"3:4" if slot == "scene:body" else "4:3"})')
        extra = set(have) - {s.replace(':', '-') for s in slots}
        if extra: W(f'pictures with no matching slot: {sorted(extra)}')

for m in errors: print('ERROR:', m)
for m in warns: print('WARN: ', m)
print(f'\n{len(errors)} error(s), {len(warns)} warning(s)')
sys.exit(1 if errors else 0)
```

---

## How to use what Codex gives you

1. In the admin go to OSCE, then **Import / export JSON**, choose `case.json`, pick the category
   and import. The case arrives as a draft.
2. Copy the files from `images/` into `backend/uploads/osce/_inbox/`.
3. Open the case, go to the **Images** tab and press **Scan inbox folder**. Each file is filed
   into the slot its name matches. You can also drop a picture straight onto a slot.
4. Check the **Preview** tab, drag the hotspots onto the right spots in the **Scenes** tab, and
   link sounds from the Auscultation library in the **Sounds** tab if the case has a Listen finding.
5. Have a clinician review the content, then publish. Publishing needs the scene pictures filled.

## Notes

- The finding, mechanism and investigation pictures are optional, so a case can be published with
  only the scene pictures and have the rest added later.
- Long cases need no pictures; they use the shared doctor and patient photos
  (Admin, OSCE, **Long-case photos**).
- ECG, X-ray and echo pictures are best linked from your own ECG library where one exists
  (Investigations tab) rather than fetched or generated.
