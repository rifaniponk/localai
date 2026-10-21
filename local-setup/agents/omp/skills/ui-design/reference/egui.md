# egui / eframe apps (0.33)

Stock egui widgets look like a debug panel. Good egui UIs come from three things: a theme, a few custom
painted widgets, and a deliberate layout. All three are ready in `egui_ui.rs` next to this file
(compiles against egui/eframe 0.33, no extra dependencies).

## Setup

1. Copy `~/.omp/agent/skills/ui-design/reference/egui_ui.rs` to `src/ui.rs` unchanged.
2. In `main.rs`: `mod ui; use ui::*;`
3. Call `apply_theme(&cc.egui_ctx)` in the creation closure of `eframe::run_native`:

```rust
fn main() -> eframe::Result<()> {
    let opts = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 820.0])
            .with_min_inner_size([960.0, 600.0]),
        ..Default::default()
    };
    eframe::run_native("App", opts, Box::new(|cc| {
        apply_theme(&cc.egui_ctx);
        Ok(Box::new(MyApp::default()))
    }))
}
```

Helpers in `ui.rs`: `card`, `card_title`, `page_header`, `kpi`, `columns`, `list_row`, `elide`, `status_dot`,
`chip`, `button(ui, label, Btn::Primary|Secondary|Danger, enabled)`, `segmented`, `nav_item`, `sparkline`,
`area_chart`, `progress`, `empty_state`, `bold(size)`, and the color tokens (`BG RAIL SURFACE SURFACE_HI ELEVATED
BORDER TEXT MUTED FAINT ACCENT GREEN AMBER RED VIOLET`).

## Layout recipe (list + detail app)

```rust
egui::SidePanel::left("nav").exact_width(210.0).resizable(false)
    .frame(egui::Frame::NONE.fill(RAIL).inner_margin(egui::Margin::symmetric(12, 16)))
    .show(ctx, |ui| { /* app name (bold 16), nav_item() per section, footer */ });

egui::SidePanel::left("list").default_width(340.0).width_range(280.0..=520.0)
    .frame(egui::Frame::NONE.fill(BG).inner_margin(egui::Margin::same(16)))
    .show(ctx, |ui| {
        // title + count, search TextEdit, segmented filter, then
        egui::ScrollArea::vertical().auto_shrink([false, false]).show(ui, |ui| {
            for item in items {
                let (r, resp) = list_row(ui, 56.0, selected == item.id);
                let p = ui.painter();
                status_dot(p, egui::pos2(r.left() + 16.0, r.center().y), GREEN, item.up);
                let name = elide(p, &item.name, egui::FontId::proportional(14.0), TEXT, r.width() - 130.0);
                p.galley(egui::pos2(r.left() + 32.0, r.top() + 10.0), name, TEXT);
                // second line (MUTED, 12px) at r.top() + 31, right-aligned metric with Align2::RIGHT_TOP
                if resp.clicked() { selected = item.id; }
            }
        });
    });

egui::CentralPanel::default()
    .frame(egui::Frame::NONE.fill(BG).inner_margin(egui::Margin { left: 28, right: 28, top: 22, bottom: 18 }))
    .show(ctx, |ui| {
        // page_header + action buttons on the right (Layout::right_to_left)
        // columns(ui, 4, 14.0, |c| kpi(&mut c[0], ...)) for metrics
        // card(ui, |ui| { card_title(..); area_chart(..) })
        // card with details: label (FAINT 11.5) above value (TEXT 13.5) in 3 columns
    });
```

Spacing rhythm: 8 between related items, 14-16 between cards, 22-28 page margins. Text sizes: 24 page title,
14.5 card title (bold), 14 body, 12-12.5 secondary, 11.5 captions. Never more than these.

## Rules

- Live data: keep history in a `VecDeque<f64>` (cap ~60), update in `update()` from elapsed time, and call
  `ctx.request_repaint_after(Duration::from_millis(250..1000))` so it animates without input.
- Every list/detail page needs an empty state (`empty_state`) for "nothing selected" / "no results".
- Destructive actions use `Btn::Danger` and a confirm `egui::Modal` (0.33 has `egui::Modal::new(id).show(ctx, ..)`).
- Put long content in `ScrollArea::vertical().auto_shrink([false, false])`.
- Use `ui.add(egui::Label::new(..).truncate())` or `elide()` for any user/data text that can be long.

## Compile-safe Rust (you may not get to run the compiler - write code that compiles first time)

- Use ONLY the helpers listed above from ui.rs and egui/eframe 0.33 APIs you are sure of. Don't call helpers that
  don't exist (e.g. `pill`, `badge`, `RichText::gamma_multiply`) - if you need one, write it in main.rs.
- One numeric type for UI math: `f32`. Store data as `f64` only if needed and convert with `as f32` at the call
  site. Never mix `f32` and `f64` in one expression (`x * 2.0` where x is f32 is fine; `x * y` with y: f64 is not).
- `#[derive(Clone, Debug)]` on every data struct and enum you put in a Vec/VecDeque or clone.
- Don't hold a borrow of `self.items` while calling a `&mut self` method: copy what you need first
  (`let selected = self.selected; let rows: Vec<_> = self.items.iter().map(..).collect();`).
- `painter.text(pos, Align2::LEFT_CENTER, text, FontId::proportional(13.0), color)` - `Align2` is `egui::Align2`.
- `Vec2::max` is a method: `a.max(b)`, not a field.
- Fake live data: `let t = ctx.input(|i| i.time);` (f64 seconds) and derive values from it; no `rand` crate
  (dependencies are not allowed) - use a tiny LCG: `seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);`.
- Keep main.rs under ~500 lines: fewer lines, fewer compile errors.
- With a `bash` tool: run `cargo build` and fix errors until it builds, then take a screenshot of the running app
  and look at it (read the PNG): `python3 ~/.omp/agent/skills/ui-design/scripts/egui-shot.py target/debug/APP shot.png`
  (headless Xvfb; needs Xvfb + ImageMagick). Review it like the web checklist in SKILL.md step 6 and fix what you see.
  Without one: write the files once, re-read main.rs top to bottom checking each rule above, fix, and stop -
  don't loop looking for a way to compile.

## Pitfalls (each one has bitten a real app)

- `RichText::strong()` does NOT make text bold - it only brightens it. Use `.font(bold(size))`.
- egui's bundled font has no ● ▶ ■ ↻ ⚠ glyphs (they render as boxes); `install_fonts` adds DejaVu Sans. Prefer
  painting dots/icons with `painter.circle_filled` / `rect_stroke` over glyphs.
- `ui.horizontal` inside a `right_to_left` layout lays children out right-to-left too (a dot ends up after its
  label). Use `ui.with_layout(Layout::left_to_right(Align::Center), ..)` there, or paint the widget yourself.
- Content inside a `bottom_up` layout is reversed; for footers, `ui.add_space(ui.available_height() - footer_h)`
  and lay out top-down instead.
- `ui.columns(n, ..)` gap = `item_spacing.x` (8 by default) - use `columns(ui, n, gap, ..)` from ui.rs.
- `Stroke::new(1.0, color)` needs `1.0_f32` in some contexts (float literal fallback warning).
- `Margin` takes `i8`, `corner_radius` takes `u8` (0.33): `Margin::same(16)`, `.corner_radius(12)`.
- `Frame::NONE` (not `Frame::none()`), `CornerRadius` (not `Rounding`), `StrokeKind::Inside` in `rect_stroke`.
- `ScrollArea` inside a `SidePanel` needs `auto_shrink([false, false])` or rows won't fill the width.
