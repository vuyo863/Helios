# Design Guidelines: Pionex Bot Profit Tracker

## Design Approach

**Selected Framework**: Material Design 3
**Rationale**: Ideal for data-intensive financial applications with strong emphasis on clarity, hierarchy, and structured information display. Material's elevation system works perfectly for card-based dashboards and form layouts.

**Key Design Principles**:
- Data clarity over decoration
- Efficient information scanning
- Professional financial aesthetic
- Mobile-responsive data presentation

---

## Typography

**Font Family**: Roboto (via Google Fonts CDN)
- Primary: Roboto Regular (400) for body text
- Emphasis: Roboto Medium (500) for table headers, labels
- Headings: Roboto Bold (700) for page titles, section headers

**Type Scale**:
- Page Titles: 2xl (24px) - bold
- Section Headers: xl (20px) - bold  
- Card Titles: lg (18px) - medium
- Body/Data: base (16px) - regular
- Labels/Meta: sm (14px) - regular
- Table Data: sm (14px) - regular for readability

---

## Spacing System

**Tailwind Units**: Consistently use 4, 6, 8, 12, 16, 24 for all spacing
- Component padding: p-6 or p-8
- Section gaps: gap-8 or gap-12
- Card spacing: p-6 internally
- Table cell padding: px-4 py-3
- Form field spacing: mb-6
- Page margins: px-6 md:px-12

---

## Layout Structure

**Navigation**:
- Top horizontal navbar with three primary links: "Übersicht", "Screenshots hochladen", "Berichte"
- Fixed or sticky navigation for persistent access
- Active state indicator (underline or background pill) for current page
- Responsive: hamburger menu on mobile (<768px)

**Page Container**:
- Max-width: max-w-7xl on large screens
- Centered with mx-auto
- Horizontal padding: px-6 md:px-12

**Grid System**:
- Dashboard stats: 2-column on tablet (md:grid-cols-2), 4-column on desktop (lg:grid-cols-4)
- Chart section: 2-column grid for line/bar charts side-by-side on desktop
- Upload page: Single column form with max-w-2xl for focused input

---

## Component Library

### Dashboard Cards (Stats)
- Elevated cards with subtle shadow (shadow-md)
- White background with rounded corners (rounded-lg)
- Padding: p-6
- Structure: Label (text-sm, text-gray-600) above value (text-2xl, font-bold)
- Icon integration: Small colored icon (24px) aligned with label
- Use green tones for profit, blue for capital, purple for percentages

### Data Tables
- Full-width responsive table with horizontal scroll on mobile
- Zebra striping (alternate row backgrounds: bg-gray-50)
- Header row: bg-gray-100, font-medium, sticky on scroll
- Cell alignment: Left for text, right for numbers
- Borders: Subtle horizontal borders (border-b border-gray-200)
- Row hover state: bg-gray-50 transition

### Charts
- Use Recharts library (React-compatible)
- Chart containers: bg-white rounded-lg shadow-md p-6
- Axis labels in text-sm text-gray-600
- Grid lines: subtle gray (#E5E5E5)
- Color palette: Blue (#2563EB) for primary data, Green (#10B981) for profits, Red (#EF4444) for losses
- Responsive: Maintain aspect ratio, reduce height on mobile

### Upload Form
- Card container: bg-white rounded-lg shadow-md p-8
- File upload zone: Dashed border, bg-gray-50, rounded-lg, p-12
- Drag-and-drop visual feedback: border-blue-500 on hover
- Form inputs: Full-width, rounded-md, border-gray-300, focus:ring-blue-500
- Labels: text-sm font-medium mb-2
- Select dropdowns: Consistent styling with text inputs
- Submit button: Full-width or prominent placement, bg-blue-600 text-white

### Buttons
- Primary: bg-blue-600 text-white px-6 py-3 rounded-md font-medium
- Secondary: bg-gray-200 text-gray-800 px-6 py-3 rounded-md
- Hover states: Slight darkening (hover:bg-blue-700)
- Disabled: opacity-50 cursor-not-allowed

### Report Filters
- Date range selector: Two date inputs side-by-side
- Filter buttons: Pill-style toggle buttons for Day/Week/Month views
- Active filter: bg-blue-600 text-white, inactive: bg-gray-200 text-gray-700

---

## Page-Specific Layouts

**Übersicht (Dashboard)**:
1. Stats grid at top (4 cards: Total Capital, Total Profit USDT, Total Profit %, Avg Daily Profit)
2. Chart section below (2-column grid: Line chart | Bar chart)
3. Full-width data table at bottom with all entries

**Screenshots hochladen**:
1. Centered form card (max-w-2xl)
2. Upload zone at top
3. Form fields in single column below
4. Submit button at bottom
5. Success message: Green alert banner at top after submission

**Berichte**:
1. Filter section at top (date range + period type toggles)
2. Stats summary (similar to dashboard but filtered)
3. Charts below (2-column grid)
4. Print button: Fixed at top-right or floating
5. Print view: @media print styles for clean PDF output

---

## Responsive Behavior

- **Mobile (<768px)**: Stack all columns, full-width cards, horizontal scroll for tables
- **Tablet (768-1024px)**: 2-column grids where applicable
- **Desktop (>1024px)**: Full multi-column layouts

---

## Accessibility

- All form inputs have associated labels
- Color is not the only indicator (use icons + text)
- Sufficient color contrast (WCAG AA minimum)
- Keyboard navigation for all interactive elements
- Focus indicators: ring-2 ring-blue-500

---

## Visual Hierarchy

- Page titles dominate at top
- Progressive disclosure: Summary stats → Charts → Detailed table
- Whitespace separates distinct sections clearly
- Consistent card elevation creates content grouping

---

## Images

No hero images needed - this is a data-focused utility application. All visual elements should be charts, icons, and data visualizations.