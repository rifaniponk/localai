//! ui.rs - a small design system for egui/eframe 0.33 apps.
//! Copy this file to `src/ui.rs`, add `mod ui;` to main.rs, call
//! `ui::apply_theme(&cc.egui_ctx)` once in the app's constructor, and build
//! screens from the helpers below instead of stock widgets.
#![allow(dead_code)]

use egui::{
    epaint::StrokeKind, Align2, Color32, CornerRadius, FontData, FontFamily, FontId, Frame, Margin,
    Painter, Pos2, Rect, Response, RichText, Sense, Shape, Stroke, TextStyle, Ui, Vec2,
};
use std::sync::Arc;

// ---- tokens -------------------------------------------------------------
// Dark, layered surfaces and ONE accent. Green/amber/red only mean status.
pub const BG: Color32 = Color32::from_rgb(11, 13, 18);
pub const RAIL: Color32 = Color32::from_rgb(15, 18, 24);
pub const SURFACE: Color32 = Color32::from_rgb(20, 24, 32);
pub const SURFACE_HI: Color32 = Color32::from_rgb(28, 33, 43);
pub const ELEVATED: Color32 = Color32::from_rgb(38, 45, 59);
pub const BORDER: Color32 = Color32::from_rgb(35, 41, 53);
pub const TEXT: Color32 = Color32::from_rgb(230, 233, 239);
pub const MUTED: Color32 = Color32::from_rgb(140, 148, 166);
pub const FAINT: Color32 = Color32::from_rgb(96, 104, 123);
pub const ACCENT: Color32 = Color32::from_rgb(88, 148, 255);
pub const GREEN: Color32 = Color32::from_rgb(52, 211, 153);
pub const AMBER: Color32 = Color32::from_rgb(245, 183, 64);
pub const RED: Color32 = Color32::from_rgb(244, 112, 112);
pub const VIOLET: Color32 = Color32::from_rgb(167, 139, 250);

/// Real bold face (RichText::strong() only changes color, not weight).
pub fn bold(size: f32) -> FontId {
    FontId::new(size, FontFamily::Name("bold".into()))
}

pub fn apply_theme(ctx: &egui::Context) {
    install_fonts(ctx);
    let mut style = (*ctx.style()).clone();
    let v = &mut style.visuals;
    v.dark_mode = true;
    v.panel_fill = BG;
    v.window_fill = SURFACE;
    v.window_stroke = Stroke::new(1.0_f32, BORDER);
    v.extreme_bg_color = SURFACE; // text edit background
    v.faint_bg_color = SURFACE;
    v.override_text_color = None;
    v.weak_text_color = Some(MUTED);
    v.selection.bg_fill = ACCENT.gamma_multiply(0.35);
    v.selection.stroke = Stroke::new(1.0_f32, ACCENT);
    v.window_corner_radius = CornerRadius::same(14);
    let w = &mut v.widgets;
    w.noninteractive.bg_stroke = Stroke::new(1.0_f32, BORDER);
    w.noninteractive.fg_stroke = Stroke::new(1.0_f32, TEXT);
    w.inactive.bg_fill = SURFACE_HI;
    w.inactive.weak_bg_fill = SURFACE_HI;
    w.inactive.bg_stroke = Stroke::new(1.0_f32, BORDER);
    w.inactive.fg_stroke = Stroke::new(1.0_f32, TEXT);
    w.hovered.bg_fill = ELEVATED;
    w.hovered.weak_bg_fill = ELEVATED;
    w.hovered.fg_stroke = Stroke::new(1.0_f32, TEXT);
    w.active.bg_fill = ELEVATED;
    w.active.weak_bg_fill = ELEVATED;
    w.active.bg_stroke = Stroke::new(1.0_f32, ACCENT);
    for s in [&mut w.noninteractive, &mut w.inactive, &mut w.hovered, &mut w.active, &mut w.open] {
        s.corner_radius = CornerRadius::same(8);
        s.expansion = 0.0;
    }
    style.spacing.item_spacing = Vec2::new(8.0, 8.0);
    style.spacing.button_padding = Vec2::new(14.0, 7.0);
    style.spacing.interact_size.y = 30.0;
    style.spacing.scroll = egui::style::ScrollStyle::floating();
    style.text_styles.insert(TextStyle::Heading, bold(22.0));
    style.text_styles.insert(TextStyle::Body, FontId::proportional(14.0));
    style.text_styles.insert(TextStyle::Button, FontId::proportional(13.5));
    style.text_styles.insert(TextStyle::Monospace, FontId::monospace(12.5));
    style.text_styles.insert(TextStyle::Small, FontId::proportional(12.0));
    ctx.set_style(style);
}

/// System fonts with egui's bundled fonts as fallback. DejaVu Sans is added
/// for symbols (● ▶ ■ ↻ ⚠ ↓ ↑) that egui's default font renders as boxes.
pub fn install_fonts(ctx: &egui::Context) {
    const DIRS: [&str; 5] = [
        "/usr/share/fonts/truetype/noto",
        "/usr/share/fonts/noto",
        "/usr/share/fonts/google-noto",
        "/usr/share/fonts/truetype/dejavu",
        "/usr/share/fonts/TTF",
    ];
    let mut fonts = egui::FontDefinitions::default();
    let mut load = |key: &str, files: &[&str]| -> Option<String> {
        let bytes = files
            .iter()
            .flat_map(|f| DIRS.iter().map(move |d| format!("{d}/{f}")))
            .find_map(|p| std::fs::read(p).ok())?;
        fonts.font_data.insert(key.to_string(), Arc::new(FontData::from_owned(bytes)));
        Some(key.to_string())
    };
    let regular = load("ui", &["NotoSans-Regular.ttf", "DejaVuSans.ttf"]);
    let heavy = load("ui-bold", &["NotoSans-Bold.ttf", "DejaVuSans-Bold.ttf"]);
    let mono = load("ui-mono", &["DejaVuSansMono.ttf", "NotoSansMono-Regular.ttf"]);
    let symbols = load("ui-symbols", &["DejaVuSans.ttf"]);
    let stock_prop = fonts.families[&FontFamily::Proportional].clone();
    let stock_mono = fonts.families[&FontFamily::Monospace].clone();
    let fam = |first: Option<String>, stock: &[String]| -> Vec<String> {
        [first, symbols.clone()].into_iter().flatten().chain(stock.iter().cloned()).collect()
    };
    let p = fam(regular, &stock_prop);
    let b = fam(heavy, &stock_prop);
    let m = fam(mono, &stock_mono);
    fonts.families.insert(FontFamily::Proportional, p);
    fonts.families.insert(FontFamily::Name("bold".into()), b);
    fonts.families.insert(FontFamily::Monospace, m);
    ctx.set_fonts(fonts);
}

// ---- containers ---------------------------------------------------------

/// Rounded surface card that fills the available width.
pub fn card<R>(ui: &mut Ui, add: impl FnOnce(&mut Ui) -> R) -> R {
    Frame::NONE
        .fill(SURFACE)
        .stroke(Stroke::new(1.0_f32, BORDER))
        .corner_radius(14)
        .inner_margin(Margin::same(18))
        .show(ui, |ui| {
            ui.set_width(ui.available_width());
            add(ui)
        })
        .inner
}

pub fn card_title(ui: &mut Ui, title: &str, right: &str) {
    ui.horizontal(|ui| {
        ui.label(RichText::new(title).font(bold(14.5)).color(TEXT));
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(RichText::new(right).size(12.0).color(FAINT));
        });
    });
    ui.add_space(4.0);
}

pub fn page_header(ui: &mut Ui, title: &str, subtitle: &str) {
    ui.label(RichText::new(title).font(bold(24.0)).color(TEXT));
    ui.label(RichText::new(subtitle).size(13.0).color(MUTED));
}

/// Metric tile: small label, big value, muted sub line, optional sparkline.
pub fn kpi(ui: &mut Ui, label: &str, value: &str, sub: &str, color: Color32, series: &[f64]) {
    Frame::NONE
        .fill(SURFACE)
        .stroke(Stroke::new(1.0_f32, BORDER))
        .corner_radius(14)
        .inner_margin(Margin::symmetric(16, 14))
        .show(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.spacing_mut().item_spacing.y = 2.0;
            ui.horizontal(|ui| {
                let (r, _) = ui.allocate_exact_size(Vec2::splat(8.0), Sense::hover());
                ui.painter().circle_filled(r.center(), 3.5, color);
                ui.label(RichText::new(label).size(12.5).color(MUTED));
            });
            ui.add(egui::Label::new(RichText::new(value).font(bold(24.0)).color(TEXT)).truncate());
            ui.add(egui::Label::new(RichText::new(sub).size(12.0).color(FAINT)).truncate());
            ui.add_space(6.0);
            let (r, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 28.0), Sense::hover());
            sparkline(ui.painter(), r, series, color);
        });
}

/// Equal-width columns with a real gap (ui.columns uses item_spacing.x).
pub fn columns(ui: &mut Ui, n: usize, gap: f32, add: impl FnOnce(&mut [Ui])) {
    ui.scope(|ui| {
        ui.spacing_mut().item_spacing.x = gap;
        ui.columns(n, add);
    });
}

// ---- rows, badges, buttons ----------------------------------------------

/// A clickable list row you paint yourself. Returns (rect, response); paint
/// text into `rect` with `elide` so long names never overflow.
pub fn list_row(ui: &mut Ui, height: f32, selected: bool) -> (Rect, Response) {
    let (rect, resp) = ui.allocate_exact_size(Vec2::new(ui.available_width(), height), Sense::click());
    let p = ui.painter();
    if selected {
        p.rect(rect, 10.0, ACCENT.gamma_multiply(0.12), Stroke::new(1.0_f32, ACCENT.gamma_multiply(0.45)), StrokeKind::Inside);
    } else if resp.hovered() {
        p.rect_filled(rect, 10.0, SURFACE);
    }
    if resp.hovered() {
        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
    }
    (rect, resp)
}

/// Single-line text clipped to `max_w` with an ellipsis.
pub fn elide(p: &Painter, text: impl Into<String>, font: FontId, color: Color32, max_w: f32) -> Arc<egui::Galley> {
    let mut job = egui::text::LayoutJob::simple_singleline(text.into(), font, color);
    job.wrap = egui::text::TextWrapping {
        max_width: max_w.max(1.0),
        max_rows: 1,
        break_anywhere: true,
        overflow_character: Some('…'),
    };
    p.layout_job(job)
}

/// Status dot: glowing filled circle when ok, hollow ring when not.
pub fn status_dot(p: &Painter, c: Pos2, color: Color32, on: bool) {
    if on {
        p.circle_filled(c, 7.0, color.gamma_multiply(0.18));
        p.circle_filled(c, 4.0, color);
    } else {
        p.circle_stroke(c, 3.5, Stroke::new(1.5_f32, color));
    }
}

/// Small rounded label, e.g. chip(ui, "Healthy", GREEN).
pub fn chip(ui: &mut Ui, text: &str, color: Color32) {
    Frame::NONE
        .fill(color.gamma_multiply(0.14))
        .corner_radius(10)
        .inner_margin(Margin::symmetric(9, 3))
        .show(ui, |ui| {
            ui.label(RichText::new(text).size(11.5).color(color));
        });
}

#[derive(Clone, Copy)]
pub enum Btn {
    Primary,
    Secondary,
    Danger,
}

pub fn button(ui: &mut Ui, label: &str, kind: Btn, enabled: bool) -> Response {
    let (fill, fg, stroke) = match kind {
        Btn::Primary => (ACCENT, Color32::from_rgb(11, 13, 18), ACCENT),
        Btn::Secondary => (SURFACE_HI, TEXT, BORDER),
        Btn::Danger => (RED.gamma_multiply(0.12), RED, RED.gamma_multiply(0.4)),
    };
    ui.add_enabled(
        enabled,
        egui::Button::new(RichText::new(label).size(13.5).color(fg))
            .fill(fill)
            .stroke(Stroke::new(1.0_f32, stroke))
            .corner_radius(8)
            .min_size(Vec2::new(0.0, 34.0)),
    )
}

/// Segmented control. Returns the newly picked index.
pub fn segmented(ui: &mut Ui, labels: &[&str], current: usize) -> Option<usize> {
    let h = 32.0;
    let (rect, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), h), Sense::hover());
    ui.painter().rect(rect, 9.0, SURFACE, Stroke::new(1.0_f32, BORDER), StrokeKind::Inside);
    let w = (rect.width() - 6.0) / labels.len() as f32;
    let mut out = None;
    for (i, label) in labels.iter().enumerate() {
        let r = Rect::from_min_size(rect.min + Vec2::new(3.0 + i as f32 * w, 3.0), Vec2::new(w, h - 6.0));
        let resp = ui.interact(r, ui.id().with(("seg", i)), Sense::click());
        if i == current {
            ui.painter().rect_filled(r, 7.0, ELEVATED);
        } else if resp.hovered() {
            ui.painter().rect_filled(r, 7.0, SURFACE_HI);
        }
        let color = if i == current { TEXT } else { MUTED };
        ui.painter().text(r.center(), Align2::CENTER_CENTER, *label, FontId::proportional(12.5), color);
        if resp.clicked() {
            out = Some(i);
        }
    }
    out
}

/// Sidebar navigation item with an optional count badge; true when clicked.
pub fn nav_item(ui: &mut Ui, label: &str, badge: &str, active: bool) -> bool {
    let (rect, resp) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 36.0), Sense::click());
    let p = ui.painter();
    if active {
        p.rect_filled(rect, 9.0, ACCENT.gamma_multiply(0.15));
        p.rect_filled(Rect::from_center_size(Pos2::new(rect.left() + 1.5, rect.center().y), Vec2::new(3.0, 18.0)), 2.0, ACCENT);
    } else if resp.hovered() {
        p.rect_filled(rect, 9.0, SURFACE_HI);
    }
    let fg = if active || resp.hovered() { TEXT } else { MUTED };
    p.text(Pos2::new(rect.left() + 14.0, rect.center().y), Align2::LEFT_CENTER, label, FontId::proportional(14.0), fg);
    if !badge.is_empty() {
        let g = p.layout_no_wrap(badge.to_string(), FontId::proportional(11.5), MUTED);
        let br = Rect::from_min_size(
            Pos2::new(rect.right() - 8.0 - g.size().x - 14.0, rect.center().y - 10.0),
            Vec2::new(g.size().x + 14.0, 20.0),
        );
        p.rect_filled(br, 10.0, SURFACE_HI);
        p.galley(br.center() - g.size() / 2.0, g, MUTED);
    }
    resp.clicked()
}

// ---- charts -------------------------------------------------------------

fn points(rect: Rect, s: &[f64], max: f64) -> Vec<Pos2> {
    let n = s.len().max(2);
    s.iter()
        .enumerate()
        .map(|(i, v)| {
            Pos2::new(
                rect.left() + rect.width() * i as f32 / (n - 1) as f32,
                rect.bottom() - rect.height() * (v / max).clamp(0.0, 1.0) as f32,
            )
        })
        .collect()
}

/// Gradient fill under a polyline (alpha at the line, clear at the bottom).
fn fill_under(p: &Painter, pts: &[Pos2], bottom: f32, color: Color32, alpha: u8) {
    if pts.len() < 2 {
        return;
    }
    let top = Color32::from_rgba_unmultiplied(color.r(), color.g(), color.b(), alpha);
    let mut mesh = egui::epaint::Mesh::default();
    for q in pts {
        mesh.colored_vertex(*q, top);
        mesh.colored_vertex(Pos2::new(q.x, bottom), Color32::TRANSPARENT);
    }
    for i in 0..pts.len() as u32 - 1 {
        let a = i * 2;
        mesh.add_triangle(a, a + 1, a + 2);
        mesh.add_triangle(a + 1, a + 3, a + 2);
    }
    p.add(mesh);
}

pub fn sparkline(p: &Painter, rect: Rect, s: &[f64], color: Color32) {
    if s.len() < 2 {
        return;
    }
    let max = s.iter().cloned().fold(0.0_f64, f64::max).max(1e-9) * 1.1;
    let pts = points(rect, s, max);
    fill_under(p, &pts, rect.bottom(), color, 50);
    p.add(Shape::line(pts, Stroke::new(1.5_f32, color)));
}

/// Area chart with gridlines, a max label and a hover readout.
pub fn area_chart(ui: &mut Ui, s: &[f64], color: Color32, height: f32, fmt: fn(f64) -> String) {
    let (outer, resp) = ui.allocate_exact_size(Vec2::new(ui.available_width(), height), Sense::hover());
    let rect = Rect::from_min_max(outer.min + Vec2::new(0.0, 16.0), outer.max);
    let p = ui.painter();
    for g in 0..4 {
        let y = rect.top() + rect.height() * g as f32 / 4.0;
        p.line_segment([Pos2::new(rect.left(), y), Pos2::new(rect.right(), y)], Stroke::new(1.0_f32, SURFACE_HI));
    }
    p.line_segment([rect.left_bottom(), rect.right_bottom()], Stroke::new(1.0_f32, BORDER));
    if s.len() < 2 {
        p.text(rect.center(), Align2::CENTER_CENTER, "Collecting data…", FontId::proportional(12.0), FAINT);
        return;
    }
    let max = s.iter().cloned().fold(0.0_f64, f64::max).max(1e-9) * 1.15;
    let pts = points(rect, s, max);
    fill_under(p, &pts, rect.bottom(), color, 80);
    p.add(Shape::line(pts.clone(), Stroke::new(1.8_f32, color)));
    p.text(rect.right_top() - Vec2::new(0.0, 3.0), Align2::RIGHT_BOTTOM, fmt(max), FontId::proportional(10.5), FAINT);
    if let Some(pos) = resp.hover_pos() {
        let i = (((pos.x - rect.left()) / rect.width()) * (pts.len() - 1) as f32)
            .round()
            .clamp(0.0, (pts.len() - 1) as f32) as usize;
        let q = pts[i];
        p.line_segment([Pos2::new(q.x, rect.top()), Pos2::new(q.x, rect.bottom())], Stroke::new(1.0_f32, BORDER));
        p.circle_filled(q, 4.0, color);
        let g = p.layout_no_wrap(fmt(s[i]), FontId::proportional(11.5), TEXT);
        let mut tip = Rect::from_min_size(q + Vec2::new(8.0, -26.0), g.size() + Vec2::new(12.0, 6.0));
        if tip.right() > rect.right() {
            tip = tip.translate(Vec2::new(-tip.width() - 16.0, 0.0));
        }
        p.rect_filled(tip, 6.0, ELEVATED);
        p.galley(tip.min + Vec2::new(6.0, 3.0), g, TEXT);
    }
}

/// Thin rounded progress bar painted into `bar`.
pub fn progress(p: &Painter, bar: Rect, frac: f32, color: Color32) {
    let r = bar.height() / 2.0;
    p.rect_filled(bar, r, SURFACE_HI);
    let w = bar.width() * frac.clamp(0.0, 1.0);
    if w > 0.0 {
        p.rect_filled(Rect::from_min_size(bar.min, Vec2::new(w.max(bar.height()), bar.height())), r, color);
    }
}

/// Centered placeholder for empty lists / nothing selected.
pub fn empty_state(ui: &mut Ui, title: &str, body: &str) {
    ui.add_space((ui.available_height() * 0.3).min(160.0));
    ui.vertical_centered(|ui| {
        ui.label(RichText::new(title).font(bold(15.0)).color(TEXT));
        ui.label(RichText::new(body).size(13.0).color(MUTED));
    });
}
