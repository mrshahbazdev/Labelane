# Labelane — Store listing copy

Paste these into Partner Center. Nothing here claims a feature the app does
not have — that is what gets flagged as inaccurate representation.

---

## Submission checklist

Things only you can do in Partner Center (partner.microsoft.com/dashboard):

1. **Developer account.** Individual accounts are free for Windows apps.
2. **Reserve the name** "Labelane" under Apps and games → New product → MSIX or PWA app.
3. **Copy the identity.** Product management → Product identity. Put the three
   values into `package.json` → `build.appx`:
   - `Package/Identity/Name`      → `identityName`
   - `Package/Identity/Publisher` → `publisher` (starts with `CN=`)
   - `Package/Properties/PublisherDisplayName` → `publisherDisplayName`
4. **Build:** `npm run dist:win` → `release/Labelane 1.0.0.appx`. No code-signing
   certificate is needed; the Store signs it.
5. **Pricing and availability:** Free, all markets.
6. **Properties:** Category *Productivity* (or *Business*). Privacy policy URL
   from `docs/privacy.html`. Declare that the app does not collect personal info.
7. **Age ratings:** Complete the IARC questionnaire. No violence, no user
   interaction, no purchases, no data sharing → it comes out as 3+ / Everyone.
8. **Packages:** Upload the .appx.
9. **Store listing (English):** Description, features, search terms from this
   file; screenshots and logos from `build/store/`.
10. **Submission options → Notes for certification:** paste the section below,
    which also justifies the `runFullTrust` restricted capability.

Each new release must have a higher `version` in `package.json` than the last
upload.

---

## Product name

    Labelane

Reserve it first under **Manage app names**. That check is authoritative;
a web search is only a first filter.

---

## Short description (270 char max)

    Design thermal labels and barcodes, then print a whole spreadsheet of them.
    Millimetre-accurate sizing, 16 barcode symbologies including Data Matrix and
    GS1-128, auto-increment serials and expiry dates. Works offline. Free.

---

## Description

    Labelane turns a spreadsheet into a roll of labels.

    Design once on a millimetre-accurate canvas, load a CSV or Excel file, and
    print. The label that comes out of the printer is the size you asked for —
    there is no scaling step anywhere between the canvas and the paper.

    DESIGN
    Drag and drop text, barcodes, QR codes, images, boxes and lines. Snap to the
    label's centre lines and to other elements. Align, distribute, group by
    layer, lock what you don't want to move. Full undo and redo.

    BARCODES
    Code 128, EAN-13, EAN-8, UPC-A, Code 39, Code 93, Codabar, ITF-14, MSI and
    Pharmacode. Plus Data Matrix, GS1 Data Matrix, GS1-128, PDF417, Aztec and QR
    for pharma, electronics and logistics. An invalid value prints a visible
    error box instead of a silent blank space.

    DYNAMIC FIELDS
    Pull columns from your data with {{sku}}. Auto-increment with
    {{serial:start=1000,pad=5}}. Print expiry dates with {{date:+180}}. Do maths
    across columns with {{= price * 1.17 }}. Chain transforms for formatting,
    padding and fallbacks.

    Text shrinks automatically when a long value would overflow its box, and
    elements can hide themselves when their value is empty — so one template
    survives a whole catalogue.

    PRINTING
    Thermal roll printers print one label per page at the exact millimetre size
    you set. For laser and inkjet, sheet mode lays out a grid on A4 with presets
    for common die-cut sheets, and warns you before printing if the grid does not
    fit the page.

    Print everything, just the row you are previewing, or a range. The preview
    renders the same HTML that goes to the printer, so clipped elements and
    failed barcodes show up before the roll is spent.

    Right-to-left text is supported for Urdu and Arabic.

    Labelane is free, with no limits and no account required. Everything stays on
    your computer.

---

## Product features (one per box)

    Millimetre-accurate label sizing with no scaling step
    Drag-and-drop designer with snapping, align and distribute
    16 barcode symbologies including Data Matrix, GS1-128 and PDF417
    Import data from Excel or CSV
    Auto-increment serial numbers and expiry dates
    Arithmetic and text transforms on data fields
    Text shrinks automatically to fit its box
    Sheet mode for A4 label sheets with common presets
    Print preview rendered from the real print output
    Right-to-left text for Urdu and Arabic
    Works entirely offline, no account needed

---

## Search terms (7 max, 21 words total)

    barcode label maker
    thermal printer
    label designer
    qr code
    sku labels
    price tags
    data matrix

---

## Copyright

    © 2026 Muhammad Shahbaz. All rights reserved.

---

## Additional system requirements

    A thermal or laser printer is required to print. A barcode scanner is not
    required.

---

## Notes for certification (Additional Testing Information)

    Labelane needs no account, login, store connection or purchase. It is fully
    functional on first launch.

    To evaluate it:
    1. The app opens with a sample product label already loaded.
    2. In the Data panel, click "Sample" to load three example rows. The label
       fills with real values.
    3. Click "Fields" in the Data panel to see the dynamic field reference.
    4. Click Print, then "Save PDF" to produce output without a physical
       printer. The PDF is written to the app's folder and the path is shown.
    5. Sheet layout can be switched on in the inspector when nothing is
       selected, to see A4 grid output.

    The app is built with Electron. The runFullTrust capability is a standard and
    mandatory requirement for Electron-based desktop applications; the Electron
    runtime executes as a full-trust Win32 process and cannot run inside the
    restricted AppContainer sandbox. It is used only for local file access
    (reading CSV/Excel files the user picks, saving PDFs and templates to the
    app's own data folder) and for printing to the user's installed printers.

    No data leaves the machine. The app makes no network requests.

---

## Screenshots (Desktop, 1920x1080)

Already captured from the real app in `build/store/screenshots/`. Upload in
this order and paste the caption under each:

    01-designer.png               Design on a millimetre-accurate canvas, bound to your spreadsheet
    02-barcode-symbologies.png    16 barcode types including Data Matrix, GS1-128 and PDF417
    03-dynamic-fields.png         Serials, expiry dates and maths straight from your data
    04-print-preview.png          Preview the exact print output before you spend the roll
    05-sheet-layout.png           A4 label sheets for laser and inkjet printers
    06-sheet-print-preview.png    Every label on the sheet, placed to the millimetre

Regenerate after UI changes with `npm run store:screenshots`.

---

## Store logos and artwork

Generated from `build/logo-mark.svg` by `npm run store:assets`, in `build/store/`:

    AppTile300.png            1:1 app tile icon (300x300)
    BoxArt1080.png            1:1 box art (1080x1080)
    BoxArt2160.png            1:1 box art (2160x2160)
    Poster720x1080.png        2:3 poster art (720x1080)
    Poster1440x2160.png       2:3 poster art (1440x2160)
    SuperHero1920x1080.png    16:9 super hero art (1920x1080)
    SuperHero3840x2160.png    16:9 super hero art (3840x2160)

The in-package icons (tiles, taskbar, Start, splash) are in `build/appx/` and
are packed into the .appx automatically. The previous hand-made images are
kept in `build/original-assets/`.

---

## Privacy policy

Ready to host: `docs/privacy.html`. Put it on any public URL (GitHub Pages
works) and paste that URL into Partner Center.

Labelane makes no network requests at all, which makes this short.

    Labelane does not collect, transmit or store any personal data.

    All templates, imported data files and generated PDFs stay on your own
    computer, inside the application's folder in your user profile. Nothing is
    uploaded anywhere.

    Labelane makes no network requests. It has no account system, no analytics
    and no telemetry.

    Files you open (CSV, Excel, images) are read only when you choose them and
    are never copied anywhere outside the application's own folder.

    To remove all Labelane data, uninstall the app and delete its folder in
    %LOCALAPPDATA%\Packages.

    Contact: mrshahbaznns@gmail.com
