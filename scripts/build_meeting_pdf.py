"""Build the phone-readable PDF fallback from the pinned public research pass.

Reproduce with reportlab==4.4.4 and the vendored DejaVu font. No network,
private dossier, recruiter decision or live GitHub response enters the PDF.
"""

from hashlib import sha256
from html import escape
from json import loads
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A5
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "data/poolday-public-pass-2026-09-28.json"
FONT = ROOT / "assets/fonts/DejaVuSans.ttf"
OUTPUT = ROOT / "docs/meeting-brief.uk.pdf"
ARCHIVE_SHA256 = "44b427089ca164acc5419326f2b5586a23b9a0c081b682f8b69dceadd129e660"
FONT_SHA256 = "ae7b7855e115a5966d8b1b3f80f254ccc117ec86f9965e202ee2940453837280"
SOURCE_IDS = {
    "github-pr:remotion-dev/remotion:11763",
    "github-pr:remotion-dev/remotion:11703",
}
INK = colors.HexColor("#1B3029")
GREEN = colors.HexColor("#245A3C")
MUTED = colors.HexColor("#526359")
PALE = colors.HexColor("#E8EFE4")
LINE = colors.HexColor("#C9D7C9")
PAGE_WIDTH, PAGE_HEIGHT = A5


def pinned_input():
    raw = ARCHIVE.read_bytes()
    if sha256(raw).hexdigest() != ARCHIVE_SHA256:
        raise ValueError("public archive hash mismatch")
    if sha256(FONT.read_bytes()).hexdigest() != FONT_SHA256:
        raise ValueError("PDF font hash mismatch")
    data = loads(raw.decode("utf-8"))
    report = data["report"]
    inspections = data["inspections"]
    if (
        data["schema"] != "signal-desk-showcase.v1"
        or data["source"] != "public-github-api-snapshot"
        or report["schema"] != "signal-desk-research.v3"
        or report["run"]["status"] != "complete"
        or report["run"]["requests"] != 5
        or len(report["lanes"]) != 5
        or len(report["leads"]) != 8
        or sum(len(lead["evidence"]) for lead in report["leads"]) != 14
        or {item["evidenceId"] for item in inspections} != SOURCE_IDS
        or len(inspections) != 2
    ):
        raise ValueError("unexpected release archive shape")
    featured = [
        lead for lead in report["leads"]
        if {item["id"] for item in lead["evidence"]} >= SOURCE_IDS
    ]
    if len(featured) != 1 or featured[0]["id"] != "github:1629785":
        raise ValueError("unexpected featured GitHub identity")
    return report, inspections, featured[0]


def styles():
    def style(name, size, leading, color=INK, space_after=0):
        return ParagraphStyle(
            name,
            fontName="DejaVu",
            fontSize=size,
            leading=leading,
            textColor=color,
            alignment=TA_LEFT,
            spaceAfter=space_after,
            splitLongWords=True,
        )

    return {
        "eyebrow": style("eyebrow", 8.5, 12, GREEN, 9),
        "title": style("title", 20, 26, INK, 11),
        "lead": style("lead", 11.2, 17, INK, 11),
        "body": style("body", 9.2, 14.5, INK, 8),
        "muted": style("muted", 8.4, 13, MUTED, 7),
        "heading": style("heading", 13, 18, INK, 10),
        "source": style("source", 10.5, 15, GREEN, 7),
        "file": style("file", 7.8, 11.6, INK, 2),
        "metric": style("metric", 17, 22, INK, 3),
        "metric_label": style("metric_label", 7.4, 10.5, MUTED),
        "lane": style("lane", 9.1, 13, INK, 1),
        "small": style("small", 7.7, 11.5, MUTED, 6),
    }


def paragraph(value, style):
    return Paragraph(escape(str(value)), style)


def linked(label, url, style):
    if not isinstance(url, str) or not url.startswith("https://"):
        raise ValueError("refusing non-HTTPS PDF link")
    return Paragraph(
        f'<link href="{escape(url, quote=True)}" color="#245A3C">{escape(label)}</link>',
        style,
    )


def footer(pdf, document):
    pdf.saveState()
    pdf.setStrokeColor(LINE)
    pdf.line(28, 29, PAGE_WIDTH - 28, 29)
    pdf.setFillColor(MUTED)
    pdf.setFont("DejaVu", 7.1)
    pdf.drawString(28, 17, "SIGNAL DESK  /  АРХІВ 28.09.2026")
    pdf.drawRightString(PAGE_WIDTH - 28, 17, str(document.page))
    pdf.restoreState()


class FixedMetadataCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        kwargs["invariant"] = 1
        super().__init__(*args, **kwargs)


def build(output=OUTPUT):
    report, inspections, featured = pinned_input()
    pdfmetrics.registerFont(TTFont("DejaVu", str(FONT)))
    s = styles()
    width = PAGE_WIDTH - 56
    document = SimpleDocTemplate(
        str(output),
        pagesize=A5,
        leftMargin=28,
        rightMargin=28,
        topMargin=30,
        bottomMargin=42,
        title="Signal Desk - офлайн-картка публічного проходу",
        author="Signal Desk",
        subject="Архівний публічний дослідницький прохід; без рішень про найм",
        pageCompression=1,
    )
    story = [
        paragraph("SIGNAL DESK / ПУБЛІЧНИЙ АРХІВ", s["eyebrow"]),
        paragraph("Офлайн-картка для розмови", s["title"]),
        paragraph("Одна роль. П’ять напрямів. Два точні PR одного GitHub ID.", s["lead"]),
        linked(report["role"]["title"] + " ↗", report["role"]["url"], s["source"]),
        paragraph(
            "Фактичний публічний API-прохід від " + report["run"]["observedAt"]
            + ". Це архів, не поточний GitHub і не список придатних кандидатів.",
            s["muted"],
        ),
    ]
    metric_cells = [
        ("8", "GitHub ID"),
        ("5/5", "напрямів із відповіддю"),
        ("14", "пов’язаних PR"),
    ]
    metrics = Table(
        [[Paragraph(value, s["metric"]) for value, _ in metric_cells],
         [Paragraph(label, s["metric_label"]) for _, label in metric_cells]],
        colWidths=[width / 3] * 3,
        hAlign="LEFT",
    )
    metrics.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
    ]))
    story += [Spacer(1, 10), metrics, Spacer(1, 19)]
    story += [
        paragraph("Що тут можна перевірити", s["heading"]),
        paragraph(
            "GitHub ID " + featured["id"].split(":", 1)[1] + " (@" + featured["handle"]
            + ") пов’язаний у збереженій відповіді API з двома PR у remotion-dev/remotion. "
            "Це два джерела про один акаунт, не дві людини.",
            s["body"],
        ),
    ]
    for item in inspections:
        number = item["evidenceId"].rsplit(":", 1)[1]
        story.append(linked("remotion-dev/remotion · PR #" + number + " ↗", item["sourceUrl"], s["source"]))
    story += [Spacer(1, 13), HRFlowable(width="100%", thickness=0.6, color=LINE), Spacer(1, 13)]
    story += [
        paragraph("Походження і межа", s["heading"]),
        paragraph(
            "Релізний JSON звірено за SHA-256. Це перевірка байтів файла, а не незалежне "
            "підтвердження авторства, професійного рівня чи поточного стану джерел. "
            "Оцінок рекрутера в архіві немає.",
            s["body"],
        ),
        paragraph("SHA-256 архіву: " + ARCHIVE_SHA256, s["small"]),
        paragraph("Збережи PDF до втрати мережі. Посилання на GitHub працюють лише онлайн.", s["small"]),
        PageBreak(),
        paragraph("Два PR: архівні файли", s["heading"]),
        paragraph("Текст diff не входить до картки. Кожен список показує 8 із 10 змінених файлів.", s["muted"]),
    ]
    for item in inspections:
        number = item["evidenceId"].rsplit(":", 1)[1]
        if item["shownCount"] != 8 or item["fileCount"] != 10 or len(item["files"]) != 8:
            raise ValueError("unexpected archived source-file bounds")
        block = [
            linked("PR #" + number + " - відкрити точне джерело ↗", item["sourceUrl"], s["source"]),
        ]
        for file in item["files"]:
            block.append(paragraph(file["filename"], s["file"]))
        block.append(Spacer(1, 11))
        story.append(KeepTogether(block))
    story += [
        PageBreak(),
        paragraph("П’ять пошукових напрямів", s["heading"]),
        paragraph("Лічильники описують відбір у цьому проході, не повноту ринку.", s["muted"]),
    ]
    names = {
        "video-timeline": "Відеотаймлайн і редактор",
        "agent-orchestration": "Оркестрація агентів",
        "ts-agent-tooling": "Інструменти агентів на TypeScript",
        "programmable-editor": "Програмовані редактори",
        "agent-recovery": "Відновлення агентів",
    }
    if {lane["id"] for lane in report["lanes"]} != set(names):
        raise ValueError("unexpected search lanes")
    for lane in report["lanes"]:
        story.append(paragraph(names[lane["id"]] + " · " + lane["repo"], s["lane"]))
        story.append(paragraph(
            f'{lane["scanned"]} переглянуто · {lane["skipped"]} пропущено · '
            f'{lane["observations"]} PR збережено', s["small"]
        ))
    story += [
        Spacer(1, 9), HRFlowable(width="100%", thickness=0.6, color=LINE), Spacer(1, 13),
        paragraph("Три питання для наступної людини", s["heading"]),
        paragraph("1. Який особистий внесок належить акаунту в кожному PR?", s["body"]),
        paragraph("2. Чи відповідає досвід повній ролі, а не одному сліду?", s["body"]),
        paragraph("3. Чи є знахідка новою й корисною рекрутеру?", s["body"]),
        paragraph(
            "Це картка для подальшого дослідження. Вона не схвалює контакт, співбесіду чи найм. "
            "Час API-збору не є часом до придатного кандидата.",
            s["muted"],
        ),
    ]
    document.build(story, onFirstPage=footer, onLaterPages=footer, canvasmaker=FixedMetadataCanvas)
    return output


if __name__ == "__main__":
    build()
