import SwiftUI
import MapKit

// ── Search Bar ────────────────────────────────────────────────────────────────

struct SearchBarView: View {
    @ObservedObject var vm: AppViewModel
    @Binding var isActive: Bool
    @Binding var mapRegion: MKCoordinateRegion
    @State private var query   = ""
    @State private var results: [MKMapItem] = []

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                // Logo
                SunLogoView(size: 30)

                Text("SonnenFleck")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.sfText)

                // Search field
                TextField("Ort suchen…", text: $query, onEditingChanged: { isActive = $0 })
                    .font(.system(size: 15))
                    .foregroundColor(.sfText)
                    .submitLabel(.search)
                    .onSubmit { search() }
                    .onChange(of: query) { _ in
                        if query.count > 2 { search() } else { results = [] }
                    }

                if !query.isEmpty {
                    Button(action: { query = ""; results = []; isActive = false }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.sfMuted)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.sfSurface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.18), radius: 16, x: 0, y: 2)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(Color.sfBorder, lineWidth: 0.5)
            )

            // Results dropdown
            if !results.isEmpty && isActive {
                VStack(spacing: 0) {
                    ForEach(results.prefix(5), id: \.self) { item in
                        Button(action: { selectResult(item) }) {
                            HStack {
                                Image(systemName: "mappin")
                                    .foregroundColor(.sfOrange)
                                    .font(.system(size: 13))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.name ?? "Unbekannt")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.sfText)
                                    if let locality = item.placemark.locality {
                                        Text(locality)
                                            .font(.system(size: 12))
                                            .foregroundColor(.sfMuted)
                                    }
                                }
                                Spacer()
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                        }
                        .buttonStyle(.plain)
                        if item != results.prefix(5).last { Divider().padding(.leading, 44) }
                    }
                }
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .shadow(color: .black.opacity(0.14), radius: 24, x: 0, y: 4)
                .padding(.top, 4)
            }
        }
    }

    private func search() {
        let req = MKLocalSearch.Request()
        req.naturalLanguageQuery = query + " Schweiz"
        req.region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 46.8, longitude: 8.2),
            span: MKCoordinateSpan(latitudeDelta: 4, longitudeDelta: 4)
        )
        MKLocalSearch(request: req).start { resp, _ in
            results = resp?.mapItems ?? []
        }
    }

    private func selectResult(_ item: MKMapItem) {
        let coord = item.placemark.coordinate
        vm.setLocation(lat: coord.latitude, lng: coord.longitude,
                       name: item.name ?? item.placemark.locality ?? "Unbekannt")
        withAnimation { mapRegion.center = coord }
        query   = item.name ?? ""
        results = []
        isActive = false
    }
}

// ── Status Pill ───────────────────────────────────────────────────────────────

struct StatusPillView: View {
    @ObservedObject var vm: AppViewModel

    var body: some View {
        HStack(spacing: 8) {
            Text(vm.statusEmoji)
                .font(.system(size: 22))
            Text(vm.statusText)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(vm.statusTextColor)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 9)
        .background(vm.statusColor.opacity(vm.sunPos.isUp && vm.hasSun ? 1.0 : 0.9))
        .clipShape(Capsule())
        .shadow(
            color: vm.hasSun ? Color.sfYellow.opacity(0.35) : .black.opacity(0.12),
            radius: vm.hasSun ? 18 : 10,
            x: 0, y: 3
        )
        .animation(.easeInOut(duration: 0.4), value: vm.hasSun)
    }
}

// ── Bottom Sheet ──────────────────────────────────────────────────────────────

struct BottomSheetView: View {
    @ObservedObject var vm: AppViewModel
    @Binding var height: MainView.SheetHeight
    @Binding var showImpressum: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Handle
            Capsule()
                .fill(Color.sfBorder)
                .frame(width: 36, height: 4)
                .padding(.top, 10)
                .padding(.bottom, 14)

            ScrollView {
                VStack(spacing: 0) {
                    // ── Info row ──────────────────────────────────────
                    HStack(alignment: .top, spacing: 8) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(vm.locationName)
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.sfText)
                                .lineLimit(1)
                            HStack(spacing: 4) {
                                Image(systemName: "sunrise.fill").foregroundColor(.sfOrange)
                                Text(vm.sunriseText)
                                Text("·").foregroundColor(.sfMuted)
                                Image(systemName: "sunset.fill").foregroundColor(.sfOrange)
                                Text(vm.sunsetText)
                            }
                            .font(.system(size: 12))
                            .foregroundColor(.sfMuted)
                        }

                        Spacer()

                        // Favourite star
                        Button(action: { vm.toggleFavourite() }) {
                            Image(systemName: vm.isCurrentFavourite ? "star.fill" : "star")
                                .font(.system(size: 18))
                                .foregroundColor(vm.isCurrentFavourite ? .sfYellow : .sfMuted)
                                .frame(width: 40, height: 40)
                                .background(Color.white)
                                .clipShape(Circle())
                                .overlay(Circle().strokeBorder(Color.sfBorder, lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 14)

                    Divider().padding(.horizontal, 16).padding(.bottom, 14)

                    // ── Time display + slider ─────────────────────────
                    VStack(spacing: 10) {
                        HStack {
                            Text(vm.timeDisplayString)
                                .font(.system(size: 36, weight: .heavy, design: .rounded))
                                .foregroundColor(.sfOrange)
                                .monospacedDigit()

                            Spacer()

                            // Minutes remaining
                            if let mins = vm.minutesUntilChange {
                                HStack(spacing: 4) {
                                    Image(systemName: "clock")
                                    Text("Noch \(mins) Min Sonne")
                                }
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.sfOrange)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(Color.sfOrange.opacity(0.12))
                                .clipShape(Capsule())
                            }
                        }

                        // Slider
                        HStack(spacing: 8) {
                            Text("🌅").font(.system(size: 16))
                            Slider(value: Binding(
                                get: { vm.sliderHour },
                                set: { vm.setHour($0) }
                            ), in: 5...22, step: 0.25)
                            .tint(
                                LinearGradient(
                                    colors: [.sfOrange, .sfYellow],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            Text("🌇").font(.system(size: 16))
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 14)

                    // ── Date + animation controls ─────────────────────
                    HStack(spacing: 8) {
                        DatePicker("", selection: Binding(
                            get: { vm.selectedDate },
                            set: { vm.selectedDate = $0; vm.update() }
                        ), displayedComponents: .date)
                        .labelsHidden()
                        .tint(.sfOrange)

                        Spacer()

                        // Speed picker
                        Menu {
                            ForEach([0.5, 1.0, 2.0, 4.0], id: \.self) { s in
                                Button("\(s == 0.5 ? "0.5" : String(Int(s)))×") {
                                    vm.animSpeed = s
                                }
                            }
                        } label: {
                            Text("\(vm.animSpeed == 0.5 ? "0.5" : String(Int(vm.animSpeed)))×")
                                .font(.system(size: 13))
                                .foregroundColor(.sfText)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 7)
                                .background(Color.white)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color.sfBorder, lineWidth: 1.5))
                        }

                        // Play/pause
                        Button(action: { vm.toggleAnimation() }) {
                            Image(systemName: vm.isAnimating ? "pause.fill" : "play.fill")
                                .font(.system(size: 15))
                                .foregroundColor(.white)
                                .frame(width: 40, height: 40)
                                .background(Color.sfOrange)
                                .clipShape(Circle())
                                .shadow(color: Color.sfOrange.opacity(0.38), radius: 10, x: 0, y: 2)
                        }
                        .buttonStyle(.plain)

                        // Now button
                        Button(action: { vm.setToNow() }) {
                            Text("Jetzt")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(.sfOrange)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(Color.white)
                                .clipShape(Capsule())
                                .overlay(Capsule().strokeBorder(Color.sfOrange, lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 14)

                    Divider().padding(.horizontal, 16).padding(.bottom, 12)

                    // ── Activity selector ─────────────────────────────
                    ActivitySelectorView(vm: vm)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 14)

                    // ── Sun stats ─────────────────────────────────────
                    SunStatsView(vm: vm)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 14)

                    Divider().padding(.horizontal, 16).padding(.bottom, 12)

                    // ── Favourites ────────────────────────────────────
                    FavouritesView(vm: vm)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 14)

                    // ── Footer ────────────────────────────────────────
                    Button(action: { showImpressum = true }) {
                        Text("Impressum & Datenquellen")
                            .font(.system(size: 12))
                            .foregroundColor(.sfMuted)
                            .underline()
                    }
                    .buttonStyle(.plain)
                    .padding(.bottom, 32)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .background(
            Color.sfSurface
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 22))
        )
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .shadow(color: .black.opacity(0.16), radius: 32, x: 0, y: -4)
        .frame(height: UIScreen.main.bounds.height)
    }
}

// ── Activity Selector ─────────────────────────────────────────────────────────

struct ActivitySelectorView: View {
    @ObservedObject var vm: AppViewModel

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Activity.allCases) { act in
                    Button(action: {
                        withAnimation(.spring(response: 0.3)) { vm.selectedActivity = act }
                    }) {
                        Text(act.rawValue)
                            .font(.system(size: 13, weight: vm.selectedActivity == act ? .semibold : .regular))
                            .foregroundColor(vm.selectedActivity == act ? .white : .sfText)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(
                                vm.selectedActivity == act ? Color.sfOrange : Color.white
                            )
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().strokeBorder(
                                    vm.selectedActivity == act ? Color.clear : Color.sfBorder,
                                    lineWidth: 1.5
                                )
                            )
                            .shadow(
                                color: vm.selectedActivity == act ? Color.sfOrange.opacity(0.3) : .clear,
                                radius: 8, x: 0, y: 2
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
    }
}

// ── Sun Stats ─────────────────────────────────────────────────────────────────

struct SunStatsView: View {
    @ObservedObject var vm: AppViewModel

    var body: some View {
        HStack(spacing: 8) {
            StatCard(value: vm.sunriseText, label: "Aufgang", icon: "sunrise.fill")
            StatCard(value: vm.sunsetText, label: "Untergang", icon: "sunset.fill")
            StatCard(value: String(format: "%.0f°", vm.sunPos.azimuthDeg), label: "Azimut", icon: "safari")
            StatCard(value: String(format: "%.0f°", vm.sunPos.altitudeDeg), label: "Höhe", icon: "angle")
        }
    }
}

struct StatCard: View {
    let value: String
    let label: String
    let icon:  String

    var body: some View {
        VStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundColor(.sfOrange)
            Text(value)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundColor(.sfText)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(.sfMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Color.sfBg)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// ── Favourites ────────────────────────────────────────────────────────────────

struct FavouritesView: View {
    @ObservedObject var vm: AppViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Favoriten")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.sfMuted)
                .textCase(.uppercase)
                .tracking(0.6)

            if vm.favourites.isEmpty {
                Text("Noch keine Favoriten – tippe auf ★ um einen Ort zu speichern.")
                    .font(.system(size: 13))
                    .foregroundColor(.sfMuted)
                    .padding(.vertical, 4)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(vm.favourites) { fav in
                            FavChip(fav: fav) {
                                vm.selectFavourite(fav)
                            } onDelete: {
                                vm.deleteFavourite(fav)
                            }
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }
}

struct FavChip: View {
    let fav: Favourite
    let onSelect: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 5) {
            Button(action: onSelect) {
                Text(fav.name)
                    .font(.system(size: 13))
                    .foregroundColor(.sfText)
                    .lineLimit(1)
            }
            .buttonStyle(.plain)

            Button(action: onDelete) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.sfMuted)
            }
            .buttonStyle(.plain)
        }
        .padding(.leading, 12)
        .padding(.trailing, 8)
        .padding(.vertical, 6)
        .background(Color.white)
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(Color.sfBorder, lineWidth: 1.5))
    }
}

// ── Impressum ─────────────────────────────────────────────────────────────────

struct ImpressumView: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Group {
                        Text("SonnenFleck")
                            .font(.system(size: 22, weight: .heavy))
                        Text("Eine kostenlose App zur Echtzeit-Schattenvisualisierung in der Schweiz. Keine Werbung, kein Tracking, kein Login.")
                            .font(.system(size: 14))
                            .foregroundColor(.sfMuted)
                    }

                    Divider()

                    sectionHeader("Datenquellen")
                    dataRow("Karte", "OpenStreetMap / MapLibre", "Kostenlos")
                    dataRow("Gebäude", "Swisstopo / OSM Buildings", "Kostenlos")
                    dataRow("Sonnenberechnung", "SunCalc Algorithmus", "Open Source")
                    dataRow("Wetter", "Open-Meteo API", "Kostenlos")

                    Divider()

                    sectionHeader("Datenschutz")
                    Text("GPS-Koordinaten verlassen niemals das Gerät. Es werden keine Daten gespeichert oder übertragen.")
                        .font(.system(size: 14))
                        .foregroundColor(.sfText)

                    Divider()

                    sectionHeader("Lizenz")
                    Text("MIT License · Open Source auf GitHub")
                        .font(.system(size: 14))
                        .foregroundColor(.sfOrange)
                }
                .padding(20)
            }
            .background(Color.sfBg.ignoresSafeArea())
            .navigationTitle("Impressum")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Schliessen") { dismiss() }
                        .foregroundColor(.sfOrange)
                }
            }
        }
    }

    func sectionHeader(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold))
            .foregroundColor(.sfMuted)
            .tracking(0.6)
    }

    func dataRow(_ name: String, _ source: String, _ cost: String) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 14, weight: .medium)).foregroundColor(.sfText)
                Text(source).font(.system(size: 12)).foregroundColor(.sfMuted)
            }
            Spacer()
            Text(cost)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.green)
        }
        .padding(.vertical, 4)
    }
}
