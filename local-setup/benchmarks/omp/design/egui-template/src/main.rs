fn main() -> eframe::Result<()> {
    eframe::run_simple_native("Pulse", eframe::NativeOptions::default(), |ctx, _frame| {
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.label("Hello");
        });
    })
}
