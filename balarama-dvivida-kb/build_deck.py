#!/usr/bin/env python3
"""Build deck.pptx for the SB 10.67 guide. Palette matches guide/index.html."""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

BG      = RGBColor(0x0B, 0x0D, 0x14)
PANEL   = RGBColor(0x14, 0x1A, 0x2B)
PANEL2  = RGBColor(0x1B, 0x23, 0x38)
LINE    = RGBColor(0x24, 0x2D, 0x45)
INK     = RGBColor(0xEE, 0xF1, 0xF7)
MUTED   = RGBColor(0xA6, 0xB1, 0xC8)
FAINT   = RGBColor(0x6D, 0x77, 0x91)
GOLD    = RGBColor(0xD9, 0xA4, 0x41)   # varuni
RED     = RGBColor(0xC2, 0x62, 0x4A)   # gairika
GREEN   = RGBColor(0x5F, 0x9C, 0x78)   # sala
PURPLE  = RGBColor(0x8E, 0x86, 0xBB)

SERIF = "Georgia"
SANS  = "Calibri"
MONO  = "Consolas"

W, H = Inches(13.333), Inches(7.5)
prs = Presentation()
prs.slide_width, prs.slide_height = W, H
BLANK = prs.slide_layouts[6]


def txt(slide, l, t, w, h, align=PP_ALIGN.LEFT):
    tb = slide.shapes.add_textbox(l, t, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.paragraphs[0].alignment = align
    return tf


def line(tf, text, size, color, *, font=SANS, bold=False, italic=False,
         space_before=0, space_after=0, first=False, align=None, spacing=None):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.space_before = Pt(space_before)
    p.space_after = Pt(space_after)
    if align is not None:
        p.alignment = align
    if spacing:
        p.line_spacing = spacing
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.color.rgb = color
    r.font.name = font
    r.font.bold = bold
    r.font.italic = italic
    return p


def box(slide, l, t, w, h, fill, border=None, shape=MSO_SHAPE.ROUNDED_RECTANGLE, bw=1.2):
    s = slide.shapes.add_shape(shape, l, t, w, h)
    s.shadow.inherit = False
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if border is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = border
        s.line.width = Pt(bw)
    s.text_frame.word_wrap = True
    return s


def new(eyebrow=None, title=None, kicker=None):
    s = prs.slides.add_slide(BLANK)
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = BG
    # gold hairline down the left gutter — the deck's one recurring device
    r = box(s, Inches(0.62), Inches(0.55), Pt(2.2), Inches(6.4), GOLD, shape=MSO_SHAPE.RECTANGLE)
    r.fill.fore_color.rgb = GOLD
    if eyebrow:
        tf = txt(s, Inches(0.95), Inches(0.52), Inches(11.6), Inches(0.32))
        line(tf, eyebrow, 13, GOLD, font=SERIF, italic=True, first=True)
    if title:
        tf = txt(s, Inches(0.95), Inches(0.88), Inches(11.6), Inches(1.0))
        line(tf, title, 33, INK, font=SERIF, first=True, spacing=0.95)
    if kicker:
        tf = txt(s, Inches(0.95), Inches(1.86), Inches(11.4), Inches(0.5))
        line(tf, kicker, 15, MUTED, font=SANS, italic=True, first=True, spacing=1.15)
    return s


def bullets(slide, items, top=2.45, left=0.95, width=11.5, size=16, gap=9):
    tf = txt(slide, Inches(left), Inches(top), Inches(width), Inches(4.4))
    for i, it in enumerate(items):
        if isinstance(it, tuple):
            head, body = it
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.space_before = Pt(0 if i == 0 else gap)
            p.line_spacing = 1.18
            r = p.add_run(); r.text = "— " + head + "  "
            r.font.size = Pt(size); r.font.color.rgb = INK; r.font.name = SANS; r.font.bold = True
            r2 = p.add_run(); r2.text = body
            r2.font.size = Pt(size); r2.font.color.rgb = MUTED; r2.font.name = SANS
        else:
            line(tf, "— " + it, size, MUTED, first=(i == 0),
                 space_before=(0 if i == 0 else gap), spacing=1.18)
    return tf


def callout(slide, label, text, color, top, left=0.95, width=11.5, height=1.0):
    box(slide, Inches(left), Inches(top), Inches(width), Inches(height), PANEL, LINE)
    bar = box(slide, Inches(left), Inches(top), Pt(3), Inches(height), color, shape=MSO_SHAPE.RECTANGLE)
    bar.fill.fore_color.rgb = color
    tf = txt(slide, Inches(left + 0.22), Inches(top + 0.16), Inches(width - 0.45), Inches(height - 0.3))
    p = tf.paragraphs[0]; p.line_spacing = 1.15
    r = p.add_run(); r.text = label + "  "
    r.font.size = Pt(14); r.font.color.rgb = color; r.font.name = SANS; r.font.bold = True
    r2 = p.add_run(); r2.text = text
    r2.font.size = Pt(14); r2.font.color.rgb = MUTED; r2.font.name = SANS


def verse(slide, text, cite, top, left=0.95, width=11.5, height=1.35):
    box(slide, Inches(left), Inches(top), Inches(width), Inches(height), PANEL2, LINE)
    tf = txt(slide, Inches(left + 0.28), Inches(top + 0.18), Inches(width - 0.55), Inches(height - 0.3))
    line(tf, text, 16, RGBColor(0xDB, 0xE2, 0xEE), font=SERIF, italic=True, first=True, spacing=1.15)
    line(tf, cite.upper(), 10, FAINT, font=MONO, space_before=8)


def table(slide, rows, top, left=0.95, width=11.5, col_w=None, size=13, row_h=0.44):
    nr, nc = len(rows), len(rows[0])
    shp = slide.shapes.add_table(nr, nc, Inches(left), Inches(top), Inches(width), Inches(row_h * nr))
    tb = shp.table
    tb.first_row = True
    if col_w:
        total = sum(col_w)
        for i, cw in enumerate(col_w):
            tb.columns[i].width = Emu(int(Inches(width) * cw / total))
    for ri, row in enumerate(rows):
        tb.rows[ri].height = Inches(row_h)
        for ci, cell_text in enumerate(row):
            c = tb.cell(ri, ci)
            c.fill.solid()
            c.fill.fore_color.rgb = PANEL2 if ri == 0 else (PANEL if ri % 2 else BG)
            c.margin_left = c.margin_right = Inches(0.11)
            c.margin_top = c.margin_bottom = Inches(0.05)
            c.vertical_anchor = MSO_ANCHOR.TOP
            tf = c.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            p.line_spacing = 1.08
            r = p.add_run(); r.text = cell_text
            r.font.size = Pt(10.5 if ri == 0 else size)
            r.font.name = MONO if ri == 0 else SANS
            r.font.bold = ri == 0
            r.font.color.rgb = FAINT if ri == 0 else (INK if ci == 0 else MUTED)
    return tb


# ─────────────────────────────────────────── 1 · title
s = prs.slides.add_slide(BLANK)
s.background.fill.solid(); s.background.fill.fore_color.rgb = BG
box(s, Inches(0), Inches(0), W, Pt(3), GOLD, shape=MSO_SHAPE.RECTANGLE).fill.fore_color.rgb = GOLD
tf = txt(s, Inches(1.1), Inches(1.5), Inches(11.2), Inches(0.4))
line(tf, "CANTO 10  ·  CHAPTER 67  ·  A CLASS IN FIRST PRINCIPLES", 13, GOLD, font=MONO, first=True)
tf = txt(s, Inches(1.1), Inches(2.15), Inches(11.2), Inches(1.9))
line(tf, "A chapter about a monster", 50, INK, font=SERIF, first=True, spacing=0.95)
line(tf, "is really a chapter about you", 50, GOLD, font=SERIF, italic=True, spacing=0.95)
tf = txt(s, Inches(1.1), Inches(4.35), Inches(11.2), Inches(0.5))
line(tf, "Śrīmad-Bhāgavatam 10.67 — Lord Balarāma slays Dvivida", 21, MUTED, font=SERIF, italic=True, first=True)
box(s, Inches(1.1), Inches(5.05), Inches(4.2), Pt(1), LINE, shape=MSO_SHAPE.RECTANGLE).fill.fore_color.rgb = LINE
tf = txt(s, Inches(1.1), Inches(5.35), Inches(11.2), Inches(1.2))
line(tf, "HH Romāpāda Swami  ·  Fort Lauderdale, FL  ·  23 August 2024", 14, MUTED, first=True)
line(tf, "A study guide in 20 slides", 13, FAINT, font=MONO, space_before=7)

# ─────────────────────────────────────────── 2 · the one idea
s = new("sāra", "The one idea everything hangs off",
        "Read at face value: thirty verses of an enormous ape wrecking a coastline until Balarāma punches him to death. Read as its commentators read it: the Bhāgavatam's most precise case study in how a soul who once stood in the Lord's own abode became a demon.")
verse(s, "Dvivida did not fall because he was weak. He fell because he was strong, was proud of it, and let that pride slight the Lord's representative.",
      "the thesis of the chapter", 3.35, height=1.0)
bullets(s, [
    ("Offence to a devotee", "drains spiritual strength."),
    ("Drained of strength,", "a soul cannot resist bad association."),
    ("Bad association", "breeds anarthas — unwanted, obstructive things."),
    ("Anarthas", "breed further offence, without a floor."),
], top=4.6, size=15, gap=8)
callout(s, "The frame vs. the content.", "The fight is the frame. That chain is the content.", RED, 6.25, height=0.7)

# ─────────────────────────────────────────── 3 · where in the text
s = new("krama", "Where we are in the text",
        "Every Bhāgavatam chapter answers a question someone actually asked. Here the questioner is Mahārāja Parīkṣit — a king with seven days left to live and no time for decoration.")
verse(s, "“I wish to hear further about Śrī Balarāma, the unlimited and immeasurable Supreme Lord, whose activities are all astounding. What else did He do?”",
      "Parīkṣit's request · SB 10.67.1", 2.6, height=1.05)
table(s, [
    ["CHAPTER", "WHAT HAPPENS", "WHY IT MATTERS HERE"],
    ["10.65", "Balarāma visits Vṛndāvana; dances with the gopīs, drinks vāruṇī, drags the Yamunā off course with His plough.", "Establishes the exact scene Chapter 67 repeats. Dvivida walks into a setting we have already been shown."],
    ["10.66", "Kṛṣṇa kills Pauṇḍraka, the impostor who dressed as Viṣṇu.", "Balarāma is still in Vṛndāvana — so Parīkṣit gets no Balarāma news, hence his renewed request."],
    ["10.59", "Eight chapters earlier: Kṛṣṇa kills Narakāsura, freeing 16,100 princesses.", "The death that gives Dvivida his motive. He is not a random monster — he is a friend avenging a friend."],
], top=3.95, col_w=[1.1, 4.4, 5.0], row_h=0.72)

# ─────────────────────────────────────────── 4 · where in time
s = new("kāla", "Where we are in time — and why it matters",
        "Dvivida serves under Sugrīva in Rāmacandra's pastimes and dies in Kṛṣṇa's. If those advents are far apart, the chapter's first factual claim is really a claim about his longevity.")
# the clock, drawn
y = Inches(2.7)
box(s, Inches(0.95), y, Inches(11.5), Inches(0.5), PANEL, LINE)
for i in range(1, 14):
    x = Inches(0.95) + Emu(int(Inches(11.5) * i / 14))
    box(s, x, y, Pt(0.8), Inches(0.5), LINE, shape=MSO_SHAPE.RECTANGLE).fill.fore_color.rgb = LINE
seg = box(s, Inches(0.95) + Emu(int(Inches(11.5) * 6 / 14)), y, Emu(int(Inches(11.5) / 14)),
          Inches(0.5), PANEL2, INK, bw=1.6)
tf = txt(s, Inches(0.95), Inches(2.42), Inches(11.5), Inches(0.26))
line(tf, "ONE DAY OF BRAHMĀ (KALPA) — 1,000 FOUR-YUGA CYCLES · 14 MANUS · ≈71 EACH", 10.5, FAINT, font=MONO, first=True)
tf = txt(s, Inches(0.95) + Emu(int(Inches(11.5) * 5.1 / 14)), Inches(3.28), Inches(3.2), Inches(0.3))
line(tf, "Manu 7 — Vaivasvata", 12, INK, font=SANS, bold=True, first=True)

y2 = Inches(4.05)
box(s, Inches(0.95), y2, Inches(11.5), Inches(0.5), PANEL, LINE)
tf = txt(s, Inches(0.95), Inches(3.78), Inches(11.5), Inches(0.26))
line(tf, "71 FOUR-YUGA CYCLES OF VAIVASVATA MANU", 10.5, FAINT, font=MONO, first=True)
for cyc, col, lbl in ((24, GOLD, "Rāmacandra · cycle 24 · Tretā"), (28, INK, "Kṛṣṇa & Balarāma · cycle 28 · end of Dvāpara")):
    x = Inches(0.95) + Emu(int(Inches(11.5) * (cyc - .5) / 71))
    box(s, x, y2, Emu(int(Inches(11.5) / 71)), Inches(0.5), col, shape=MSO_SHAPE.RECTANGLE).fill.fore_color.rgb = col
span = box(s, Inches(0.95) + Emu(int(Inches(11.5) * 23.5 / 71)), Inches(4.62),
           Emu(int(Inches(11.5) * 4.5 / 71)), Pt(6), RED, shape=MSO_SHAPE.RECTANGLE)
span.fill.fore_color.rgb = RED
tf = txt(s, Inches(4.7), Inches(4.58), Inches(7.7), Inches(0.6))
line(tf, "Dvivida is alive across this entire span — ≈4 yuga-cycles, tens of millions of years.", 14, RED, first=True)
line(tf, "Rāmacandra: cycle 24, Tretā-yuga.    Kṛṣṇa & Balarāma: cycle 28, end of Dvāpara.", 12, FAINT, font=MONO, space_before=4)
callout(s, "Cirañjīva —", "a being granted exceptional longevity, persisting across yuga-cycles. So is Jāmbavān, who fights in Rāma's pastimes and again in Kṛṣṇa's, and whose daughter Jāmbavatī becomes one of Kṛṣṇa's principal queens. The same lifespan made one the Lord's father-in-law and the other His enemy — longevity is not the deciding variable.", INK, 5.55, height=1.35)

# ─────────────────────────────────────────── 5 · born to serve
s = new("janma", "Born to serve Rāma",
        "Dvivida was not made to be a demon. He was manufactured, deliberately, to help the Lord.")
bullets(s, [
    ("The loophole.", "Rāvaṇa held benedictions from Brahmā making him unkillable by whole categories of being — but he never thought to exclude animals. Viṣṇu told the demigods to father offspring in the categories the benedictions missed."),
    ("So the demigods fathered vānaras.", "The Aśvinī-kumāras produced two sons: Mainda and Dvivida, brothers, ministers in the court of the monkey-king Sugrīva."),
    ("Service in the search for Sītā.", "Both went south with Aṅgada's party of thirty thousand — Hanumān among them — the group that Sampāti, Jaṭāyu's grounded brother, finally pointed to the Aśoka grove in Laṅkā."),
    ("One of the five who remained.", "Before Rāmacandra entered the Sarayū, He designated five devotees to stay behind: Hanumān, Jāmbavān, Vibhīṣaṇa, Mainda — and Dvivida."),
], top=2.55, size=15, gap=11)
callout(s, "This is the fact the chapter turns on.", "Dvivida was hand-picked by the Lord Himself to stay. Whatever happens next happens to someone the Lord chose — which is why “could it happen to me?” is not a rhetorical question.", RED, 5.75, height=1.15)

# ─────────────────────────────────────────── 6 · strength
s = new("bala", "The measure of his strength",
        "The Bhāgavatam does not call him strong; it quantifies him twice. His strength is the raw material of his pride, and his pride is the first link in the chain.")
tf = txt(s, Inches(0.95), Inches(2.55), Inches(11.5), Inches(0.3))
line(tf, "THE JUMPING CONTEST AT THE SOUTHERN SHORE — WHO CAN CROSS 100 YOJANAS (≈800 MILES)?", 10.5, FAINT, font=MONO, first=True)
bars = [("Gaja", 10, "10 yojanas · 80 mi", RGBColor(0x3D, 0x4A, 0x6B)),
        ("Gavākṣa", 20, "20 yojanas · 160 mi", RGBColor(0x3D, 0x4A, 0x6B)),
        ("Mainda", 60, "60 yojanas · 480 mi — “I am capable”", PURPLE),
        ("Dvivida", 70, "70 yojanas · 560 mi — “I can undoubtedly jump further”", RED),
        ("Hanumān", 100, "the whole crossing — and back. The only one who did not boast.", INK)]
bx, bw_full = Inches(2.35), Inches(6.4)
for i, (name, val, lbl, col) in enumerate(bars):
    t = Inches(2.92 + i * 0.44)
    tfn = txt(s, Inches(0.95), t + Inches(0.03), Inches(1.3), Inches(0.3), align=PP_ALIGN.RIGHT)
    line(tfn, name, 13, INK, bold=True, first=True)
    b = box(s, bx, t, Emu(int(bw_full * val / 100)), Inches(0.26), col, shape=MSO_SHAPE.RECTANGLE)
    b.fill.fore_color.rgb = col
    tfl = txt(s, bx + Emu(int(bw_full * val / 100)) + Inches(0.12), t + Inches(0.02), Inches(4.6), Inches(0.3))
    line(tfl, lbl, 11.5, col if col not in (RGBColor(0x3D, 0x4A, 0x6B),) else FAINT, font=MONO, first=True)
callout(s, "The tell is in the phrasing.", "Mainda says what he can do. Dvivida says what he can do more than Mainda. Comparison is where bala quietly becomes bala-abhimāna — strength becoming pride in strength.", GOLD, 5.3, height=1.05)
callout(s, "The second figure —", "by Chapter 67 he churns the ocean with the strength of ten thousand elephants, uproots mountains, and tears down śāla hardwood one-handed. SB 10.2 already lists him among the demons available to Kaṁsa.", MUTED, 6.45, height=0.85)

# ─────────────────────────────────────────── 7 · eternal associate
s = new("nitya-siddha", "Was he an eternal associate? The hard question",
        "The commentators state that Mainda and Dvivida are eternally liberated — attendant deities in the worship of Rāmacandra. But souls in the Lord's abode do not fall. So what happened?")
bullets(s, [
    ("Jīva Gosvāmī, Bhakti-sandarbha:", "they are worshipped as āvaraṇa-devatās — “covered” attendant deities, situated in the Lord's abode as part of His retinue, not displaying Viṣṇu's fullness themselves."),
    ("Jīva Gosvāmī on this chapter:", "“…persons endowed with śakti from the spiritual realm. Because they did not respect Lakṣmaṇa — like Jaya and Vijaya — they appeared as demons in order to show the result of committing offences.”"),
    ("The finer distinction:", "some jīvas are endowed with a portion of an eternal associate's śakti and bear the same name. Such jīvas can be corrupted — because they are jīvas."),
    ("Viśvanātha Cakravartī Ṭhākura:", "“the Lord arranged their degradation to show the evil of the bad association that results from offending great personalities.”"),
], top=2.6, size=14.5, gap=11)
callout(s, "Do not generalise this.", "The souls in this world were not once residents of Vaikuṇṭha who fell. Jaya and Vijaya are an exception arranged for instruction, and so is Dvivida — “it's the exception, not the rule.” Take the lesson; don't take it as a theory of where you came from.", RED, 6.05, height=1.15)

# ─────────────────────────────────────────── 8 · the two offences
s = new("aparādha", "The two offences",
        "The offence is not pride itself. Pride is the condition. The offence is what pride produced — and there are two, both against Lakṣmaṇa, both easy to miss in the Rāmāyaṇa.")
tf = txt(s, Inches(0.95), Inches(2.6), Inches(5.5), Inches(0.3))
line(tf, "OFFENCE ONE — THE INTRODUCTION", 11, RED, font=MONO, first=True)
box(s, Inches(0.95), Inches(2.95), Inches(5.5), Inches(1.55), PANEL, RED)
tf = txt(s, Inches(1.15), Inches(3.12), Inches(5.1), Inches(1.25))
line(tf, "“Give your full, undivided attention to Rāma. The other fellow with Him — Lakṣmaṇa — is not so important.”", 15, RGBColor(0xDB, 0xE2, 0xEE), font=SERIF, italic=True, first=True, spacing=1.12)
line(tf, "Said to Sugrīva, during the introduction, while rendering service.", 12, FAINT, space_before=8)

tf = txt(s, Inches(6.9), Inches(2.6), Inches(5.5), Inches(0.3))
line(tf, "OFFENCE TWO — THE BATTLEFIELD JUDGMENT", 11, RED, font=MONO, first=True)
box(s, Inches(6.9), Inches(2.95), Inches(5.5), Inches(1.55), PANEL, RED)
tf = txt(s, Inches(7.1), Inches(3.12), Inches(5.1), Inches(1.25))
line(tf, "“What kind of great hero is this?”", 15, RGBColor(0xDB, 0xE2, 0xEE), font=SERIF, italic=True, first=True, spacing=1.12)
line(tf, "Thought — not spoken — of Lakṣmaṇa lying in great pain, struck down by the śakti weapon.", 12, FAINT, space_before=8)

callout(s, "Neither was hostile, and neither was heard.", "One was well-meant advice; the other was a private thought. Both counted. Vaiṣṇava-aparādha does not require malice, volume, or an audience.", RED, 4.85, height=1.0)
callout(s, "Both share one root.", "He measured Lakṣmaṇa against himself — low on importance, then low on heroism. Pride is not a feeling; it is a measuring instrument pointed the wrong way.", GOLD, 6.0, height=1.0)

# ─────────────────────────────────────────── 9 · why Laksmana
s = new("guru-tattva", "Why Lakṣmaṇa, of all people",
        "Shortened to “don't offend Lakṣmaṇa,” the warning invites the wrong reply: fine, but I'm unlikely to meet him. Lakṣmaṇa matters here as an instance of a category.")
verse(s, "Guru-tattva — the principle of the Lord's representative: the one who introduces the Supreme Lord, gives instruction, and gives association. Lakṣmaṇa holds this position to Rāma exactly as Balarāma does to Kṛṣṇa, and as Nanda Mahārāja does.",
      "the category, not the person", 2.7, height=1.3)
bullets(s, [
    ("The shape of the offence:", "he directed attention to the Lord while deprecating the one making the introduction possible. He kept the object of devotion and discarded the channel."),
    ("The symmetry:", "he offends the guru-tattva in Rāma's pastimes and is killed by the guru-tattva in Kṛṣṇa's. Across yugas, he is dealt with by the very principle he slighted."),
], top=4.3, size=16, gap=12)
callout(s, "The generalisation the class insists on:", "“It's not just that you're not Lakṣmaṇa, so I can mess with you.” The principle is vaiṣṇava-aparādha — offence to any devotee — and one can lose one's spiritual standing as its consequence.", RED, 5.95, height=1.1)

# ─────────────────────────────────────────── 10 · the mechanism
s = new("anartha", "The mechanism of degradation",
        "Viśvanātha Cakravartī Ṭhākura gives the sequence in one sentence, and it reads like a causal chain because it is one. Note the order: bad association is the punishment for the offence, not its cause.")
steps = [("Attendant in the Lord's abode", "āvaraṇa-devatā · eternally situated", INK),
         ("Minister of Sugrīva, servant of Rāma", "made for this service", INK),
         ("Pride in his own strength", "bala-abhimāna · the condition, not yet the offence", GOLD),
         ("Offence I — “Lakṣmaṇa is not important”", "spoken while rendering service", RED),
         ("Offence II — “What kind of hero is this?”", "thought only in the mind", RED),
         ("Spiritual strength reduced", "the reaction · not a metaphor", RED),
         ("Susceptible to bad association", "→ close friendship with Narakāsura", RED),
         ("Anarthas proliferate in his heart", "revenge · arson · sacrilege · molestation", RED),
         ("Further offences, without limit", "the loop that has no floor", RED)]
for i, (head, sub, col) in enumerate(steps):
    t = Inches(2.5 + i * 0.47)
    l = Inches(0.95 + i * 0.30)
    b = box(s, l, t, Inches(5.0), Inches(0.42), PANEL, col, bw=1.3)
    tf = txt(s, l + Inches(0.16), t + Inches(0.05), Inches(4.7), Inches(0.34))
    p = tf.paragraphs[0]
    r = p.add_run(); r.text = head + "   "
    r.font.size = Pt(12.5); r.font.color.rgb = INK; r.font.name = SANS; r.font.bold = True
    r2 = p.add_run(); r2.text = sub
    r2.font.size = Pt(10); r2.font.color.rgb = FAINT; r2.font.name = MONO
box(s, Inches(8.4), Inches(2.5), Inches(4.0), Inches(1.35), PANEL2, INK, bw=1.8)
tf = txt(s, Inches(8.62), Inches(2.68), Inches(3.6), Inches(1.05))
line(tf, "Returned — brahmajyoti or Vaikuṇṭha", 14, INK, bold=True, first=True, spacing=1.1)
line(tf, "Slain by Balarāma's bare hands, and thereby liberated. SB 2.7.34–35.", 12, MUTED, space_before=6, spacing=1.1)
tf = txt(s, Inches(8.4), Inches(4.2), Inches(4.0), Inches(2.4))
line(tf, "The descent was always a round trip.", 15, GOLD, font=SERIF, italic=True, first=True, spacing=1.15)
line(tf, "The chain has exactly one voluntary entrance — the offence. After that it runs.", 13, MUTED, space_before=12, spacing=1.2)
line(tf, "Once spiritual strength is reduced, resisting bad association is no longer a matter of resolve — because resolve is the thing that got reduced.", 13, MUTED, space_before=9, spacing=1.2)
line(tf, "Only the first three rungs are inside anyone's control.", 13, RED, bold=True, space_before=9, spacing=1.2)

# ─────────────────────────────────────────── 11 · Narakasura
s = new("saṅga", "Narakāsura: the association",
        "The friend who corrupted Dvivida is himself a study in the same disease — which is the quiet joke of the chapter.")
bullets(s, [
    ("He was not born a demon.", "He was Naraka, son of Bhūmi (the earth) and Lord Varāha. Divine parentage on both sides."),
    ("He became corrupted the same way Dvivida did —", "through bad association. By SB 10.59 he is Narakāsura, holding 16,100 princesses in prison; their appeal reached Kṛṣṇa, and freeing them required killing him."),
    ("Then the last step available.", "“He killed my best friend; I will get back at him.” Dvivida resolved to destroy Lord Kṛṣṇa's flourishing kingdom."),
], top=2.6, size=15.5, gap=11)
callout(s, "The recursion is the point.", "Naraka was corrupted by association; Dvivida was then corrupted by association with Naraka. Corruption propagates — which is why association is treated as a first-order spiritual variable, not a social detail.", GOLD, 4.95, height=1.05)
callout(s, "Motive matters for the diagnosis.", "The rampage is not appetite or madness. It is revenge — a grievance held on behalf of someone he loved. Revenge is the most self-justifying of the anarthas: it always feels like loyalty.", GREEN, 6.1, height=1.0)

# ─────────────────────────────────────────── 12 · the rampage
s = new("Ānarta", "The rampage on Ānarta",
        "He went for the region around Dvārakā. The Bhāgavatam's inventory of damage is specific, and the specificity is the argument — this is what an unchecked chain of anarthas produces in the world.")
bullets(s, [
    "Set fires that burned cities, villages, mines and cowherd dwellings.",
    "Uprooted mountains and hurled them at neighbouring kingdoms — especially Ānarta, where his friend's killer dwelt.",
    "Entered the ocean and churned its waters with his arms until the coastal regions were submerged.",
    "Tore down the trees of sages' hermitages and contaminated their sacrificial fires with his excrement and urine.",
    "Sealed men and women into mountain caves with boulders — “as a wasp imprisons smaller insects.”",
    "Destroyed the kingdom's crops in a huge form at will, and polluted women of respectable families.",
], top=2.6, size=14.5, gap=7)
table(s, [
    ["PLACE", "WHAT IT IS"],
    ["Dvārakā", "The island capital where Kṛṣṇa and Balarāma reside; Ugrasena rules over subordinate kings."],
    ["Prabhāsa", "A holy place on the coast, within the same province."],
    ["Raivataka Mountain", "In King Raivata's province — where Balarāma is found dancing. Revatī, Balarāma's wife, is his daughter."],
    ["Ānarta vs. anartha", "Ānarta is the province. Anartha is the unwanted thing. Prabhupāda once named a disciple Ānartā, to general alarm — until the province was recalled."],
], top=4.9, col_w=[2.4, 9.1], row_h=0.48, size=12)

# ─────────────────────────────────────────── 13 · Raivataka
s = new("līlā", "Raivataka: the scene he walked into",
        "Hearing sweet singing from Raivataka Mountain, Dvivida went to look. What he found was Balarāma at leisure — and every detail of the scene becomes a target.")
verse(s, "There he saw Śrī Balarāma, adorned with a garland of lotuses and appearing most attractive in every limb. He was singing amidst a crowd of young women, and since He had drunk vāruṇī liquor, His eyes rolled as if He were intoxicated. His body shone brilliantly as He behaved like an elephant in mada.",
      "the scene at Raivataka · SB 10.67", 2.65, height=1.45)
table(s, [
    ["ELEMENT", "WHAT IT IS", "WHY IT'S THERE"],
    ["Revatī", "Daughter of King Raivata (Kakudmī), and Balarāma's wife. Among the women present.", "The marriage is why Balarāma is on this mountain at all."],
    ["Vāruṇī", "A fragrant beverage. Two chapters earlier Varuṇa arranged for it to collect in a tree hollow to grace Balarāma's dancing.", "The text does not explain how it recurs here. It simply does."],
    ["Mada", "The fragrant secretion at a bull elephant's temples in rut.", "The verse's chosen simile for power in an exuberant, unguarded state."],
    ["Plough & club Sunanda", "Present — but not in His hands. He is dancing.", "Their absence is precisely what makes the next scene possible."],
], top=4.25, col_w=[2.3, 5.2, 4.0], row_h=0.6, size=12)

# ─────────────────────────────────────────── 14 · the provocation
s = new("avajñā", "The provocation",
        "A small masterpiece of characterisation. Dvivida does not attack — he heckles, and each heckle is a rung up.")
bullets(s, [
    "Climbs a branch, shakes the trees, and announces himself with the sound kilakilā.",
    "Balarāma's consorts laugh at his impudence — young, fond of joking, prone to silliness.",
    "Stung at being laughed at, he insults the girls: odd gestures with his eyebrows, walking absurdly, exposing himself and urinating — even as Balarāma looks on.",
    "Viśvanātha Cakravartī Ṭhākura adds the sharpest detail: he disrespected Balarāma by not even glancing at Him.",
    "Balarāma hurls a rock. He dodges it and seizes the pot of vāruṇī.",
    "He breaks the pot, then pulls at the girls' clothing, laughing and ridiculing Him.",
], top=2.5, size=14, gap=7)
callout(s, "The detail worth the whole slide.", "Balarāma's first response is a rock — not the club. The commentary explains why: because of Dvivida's previous position as a devotee. Even mid-provocation, the weapon He picks is a statement about memory.", RED, 4.75, height=1.05)
callout(s, "And the verdict rests elsewhere.", "Only after seeing the rudeness does Balarāma think of the disruptions in the surrounding kingdoms — and then take up club and plough. He decides on the ravaged province, not the ruined party.", GOLD, 5.9, height=1.05)

# ─────────────────────────────────────────── 15 · the fight
s = new("yuddha", "The fight, blow by blow",
        "A strict escalation in which Dvivida runs out of world to throw while Balarāma steadily discards weapons until He has none left.")
tf = txt(s, Inches(0.95), Inches(2.5), Inches(5.6), Inches(0.3))
line(tf, "DVIVIDA — ESCALATING", 11, RED, font=MONO, first=True)
tf = txt(s, Inches(6.85), Inches(2.5), Inches(5.6), Inches(0.3))
line(tf, "BALARĀMA — DISARMING", 11, INK, font=MONO, first=True)
rounds = [("Uproots a śāla tree one-handed, strikes His head", "Stands motionless as a mountain; catches the log"),
          ("Ignores the wound; another tree, then another", "Strikes his skull with the club Sunanda — “a mountain beautified by red oxide”"),
          ("Out of trees — releases a rain of stones", "Demolishes every tree, then pulverises every stone"),
          ("Clenches his fists and beats the Lord's body", "Throws aside club and plough — bare hands against bare hands"),
          ("Collapses, vomiting blood. Raivataka Mountain shakes.", "A hammering blow to the collarbone")]
for i, (l_txt, r_txt) in enumerate(rounds):
    t = Inches(2.88 + i * 0.72)
    last = i == len(rounds) - 1
    box(s, Inches(0.95), t, Inches(5.6), Inches(0.62), PANEL, RED, bw=1.6 if last else 1.1)
    tf = txt(s, Inches(1.12), t + Inches(0.1), Inches(5.3), Inches(0.45))
    line(tf, l_txt, 13, INK if last else MUTED, bold=last, first=True, spacing=1.08)
    box(s, Inches(6.85), t, Inches(5.6), Inches(0.62), PANEL2 if last else PANEL, INK, bw=1.8 if last else 1.1)
    tf = txt(s, Inches(7.02), t + Inches(0.1), Inches(5.3), Inches(0.45))
    line(tf, r_txt, 13, INK if last else MUTED, bold=last, first=True, spacing=1.08)
tf = txt(s, Inches(0.95), Inches(6.62), Inches(11.5), Inches(0.6))
line(tf, "The two columns move in opposite directions. The aggressor climbs tree → stone → fist; the Lord descends club → nothing — and that is when it ends.", 13.5, GOLD, font=SERIF, italic=True, first=True)
line(tf, "Afterwards He frees the people sealed in the caves and returns to His capital while the people chant His glories.", 12, FAINT, space_before=5)

# ─────────────────────────────────────────── 16 · liberation
s = new("mukti", "Killed, and therefore liberated",
        "The chapter closes with a doctrinal point that reframes every death in the Tenth Canto — drawn from SB 2.7, the catalogue of the Lord's scheduled incarnations.")
verse(s, "All these demoniac personalities — Pralamba, Dhenuka, Baka, Keśī, Ariṣṭa, Cāṇūra, Muṣṭika, Kuvalayāpīḍa, Kaṁsa, Yavana, Narakāsura, Pauṇḍraka; marshals like Śālva, Dvivida the monkey, Balvala, Dantavakra, the seven bulls, Śambara, Vidūratha and Rukmī — would all fight vigorously with the Lord Hari, or with Him under the names Baladeva, Arjuna, Bhīma; and the demons, being thus killed, would attain either the impersonal brahmajyoti or His personal abode in the Vaikuṇṭha planets.",
      "SB 2.7.34–35 · the scheduled incarnations", 2.6, height=1.9)
callout(s, "So the descent was a round trip.", "The soul who fell from an attendant's position in the Lord's abode is returned to it — by being killed by the Lord.", INK, 4.75, height=0.8)
callout(s, "“We don't imitate.”", "The class heads off the obvious conclusion at once: you cannot arrange to be an exception — that is what exception means. The mercy shown to Dvivida is a statement about the Lord's nature, not a strategy available to us.", RED, 5.7, height=1.0)
callout(s, "Why He appears at all — BG 4.7–8.", "Whenever dharma declines and adharma rises, He descends: to deliver the devotees, annihilate the miscreants, and re-establish dharma, age after age. Balarāma frees the caved-in villagers and kills the ape in the same afternoon.", GOLD, 6.8, height=0.62)

# ─────────────────────────────────────────── 17 · kavaca
s = new("kavaca", "Balarāma's four protections",
        "Garga-saṁhitā's armour-prayer maps each demon Balarāma killed onto the internal enemy He is asked to protect us from. The līlā becomes a prayer, and the prayer becomes a diagnosis.")
table(s, [
    ["MAY LORD BALARĀMA…", "…PROTECT ME FROM", "WHY THE PAIRING WORKS"],
    ["the enemy of Dhenukāsura", "lust · kāma", "Lust burns like a fire: once lit, it grows on what it consumes."],
    ["who killed Dvivida", "anger · krodha", "Our chapter. Dvivida is driven start to finish by revenge — and once anger takes hold it cannot be stopped from inside."],
    ["the enemy of Balvala", "greed · lobha", "Balvala contaminated the sacrifices at Naimiṣāraṇya — the appetite that fouls what it feeds on."],
    ["the enemy of Jarāsandha", "illusion · moha", "Jarāsandha attacked seventeen times, each time believing the next would work."],
], top=2.75, col_w=[3.0, 2.3, 6.2], row_h=0.66)
callout(s, "The move being made here:", "Balarāma's victories are not filed as history. Each is a demonstrated capacity, and the prayer asks Him to exercise that same capacity inside the petitioner. He has defeated anger — visibly, on Raivataka Mountain — so He is the one to ask about yours.", INK, 6.15, height=1.05)

# ─────────────────────────────────────────── 18 · the tongue
s = new("vāk-saṁyama", "Controlling the tongue",
        "A fair question in a chapter where the first offence was something said. The answer came in four resources, from most structural to most direct.")
bullets(s, [
    ("1 · Cultivate the mode of goodness.", "BG 17.15 defines austerity of speech: truthfully, and pleasingly. Both halves are the instruction — and goodness is cultivated by habit (cleanliness, compassion, charity, truthfulness), not summoned on demand."),
    ("2 · The tongue has two functions —", "tasting and vibrating. So take only kṛṣṇa-prasādam. Not as rule-following: prasādam spiritualises the tongue, so purity produces control rather than control producing purity."),
    ("3 · Learn the mechanics of speech.", "Non-violent communication, taught to devotees as empathic communication. Its root insight: understand your own needs and take the steps to meet them; do not require others to. Unmet expectation is what puts the tongue in motion."),
    ("4 · Chanting.", "The ultimate shelter — and the one that occupies both of the tongue's jobs at once."),
], top=2.5, size=14.5, gap=11)
callout(s, "The trap in half-obeying BG 17.15:", "“I just have to speak the truth, because I'm in the mode of goodness.” That is not the mode of goodness. Sattva includes the pleasingly. Truth delivered as a weapon has changed modes without changing content.", RED, 6.1, height=1.1)

# ─────────────────────────────────────────── 19 · anger
s = new("krodha", "Anger, and why bhakti is the cure",
        "The sharpest exchange of the class: “I understand once anger kicks in there is no stopping point — so I think I should stop before it kicks in. But it kicks in.”")
bullets(s, [
    ("BG 2.62–63, as a practical problem:", "from anger comes delusion, from delusion bewilderment of memory, from that the loss of intelligence. The verse describes a system that disables the faculty you would use to interrupt it."),
    ("The proof case — Bhīma and Duryodhana,", "both Balarāma's own students in club-fighting. He came to the battlefield and asked them to stop: Bhīma is stronger, Duryodhana more skilled, neither can win — stop wasting your time."),
    ("They could not stop.", "Not would not — could not. When anger controls you, you cannot hear good advice even from the wisest, dearest person in your life. Even from Balarāma. That is the ceiling on willpower."),
    ("So: change modes, don't fight them.", "Anger is ignorance and passion mixed. SB 1.2.24–26 gives the lever — worship of Viṣṇu elevates one to goodness. Give possessions, intelligence, energy, work and its fruits to Him."),
], top=2.5, size=14.5, gap=11)
callout(s, "And then the direct request.", "Not self-improvement, but the kavaca: “May Lord Balarāma, who killed Dvivida, always protect me from anger.” He can remove the tendency itself — He has done it before, in public, to the strongest angry being in the chapter. Bhakti is the cure.", GOLD, 6.15, height=1.05)

# ─────────────────────────────────────────── 20 · close
s = prs.slides.add_slide(BLANK)
s.background.fill.solid(); s.background.fill.fore_color.rgb = BG
box(s, Inches(0), Inches(7.46), W, Pt(3), GOLD, shape=MSO_SHAPE.RECTANGLE).fill.fore_color.rgb = GOLD
tf = txt(s, Inches(1.1), Inches(1.35), Inches(11.2), Inches(0.35))
line(tf, "WHERE TO INTERVENE", 12, GOLD, font=MONO, first=True)
tf = txt(s, Inches(1.1), Inches(1.85), Inches(10.8), Inches(2.2))
line(tf, "Find the last rung you actually control.", 34, INK, font=SERIF, first=True, spacing=1.0)
line(tf, "It is not bad association — by then the outcome is largely written. It is pride, and specifically the habit of measuring devotees against yourself.",
     19, MUTED, font=SERIF, italic=True, space_before=14, spacing=1.2)
box(s, Inches(1.1), Inches(4.55), Inches(4.2), Pt(1), LINE, shape=MSO_SHAPE.RECTANGLE).fill.fore_color.rgb = LINE
tf = txt(s, Inches(1.1), Inches(4.85), Inches(11.2), Inches(2.2))
line(tf, "SOURCES", 11, FAINT, font=MONO, first=True)
line(tf, "HH Romāpāda Swami, “SB 10.67 — Lord Balarāma slays Dvivida Gorilla,” Fort Lauderdale FL, 23 August 2024 (1 hr 17 min).",
     13, MUTED, space_before=8, spacing=1.2)
line(tf, "Śrīmad-Bhāgavatam 10.67 with 10.2, 10.59, 10.65, 10.66, 2.7.34–35, 1.2.24–26 · Bhagavad-gītā 2.62–63, 4.7–8, 17.15 · Vālmīki Rāmāyaṇa (Kiṣkindhā- and Uttara-kāṇḍa) · Viśvanātha Cakravartī Ṭhākura on SB 10.67 · Jīva Gosvāmī, Bhakti-sandarbha, his SB commentary and Gopāla-campū · Garga-saṁhitā · Bhaktivinoda Ṭhākura, Caitanya-śikṣāmṛta and Kṛṣṇa-saṁhitā.",
     11.5, FAINT, space_before=7, spacing=1.2)
line(tf, "Full guide: shivamtiwar2408.github.io/quiz-app/balarama-dvivida-kb/guide/index.html", 12.5, GOLD, font=MONO, space_before=10)

prs.save("/tmp/ytg-balarama-dvivida-kb/deck.pptx")
print("slides:", len(prs.slides._sldIdLst))
