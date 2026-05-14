import SwiftUI
import MapKit

// ── Root View ─────────────────────────────────────────────────────────────────

struct ContentView: View {
    @State private var showSplash = true

    var body: some View {
        ZStack {
            MainView()
            if showSplash {
                SplashView {
                    withAnimation(.easeInOut(duration: 0.7)) { showSplash = false }
                }
                .transition(.opacity)
                .zIndex(10)
            }
        }
    }
}

// ── Main View ─────────────────────────────────────────────────────────────────

struct MainView: View {
    @StateObject private var vm = AppViewModel()
    @State private var sheetHeight: SheetHeight = .mid
    @State private var showSearch   = false
    @State private var showImpressum = false
    @State private var mapRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 47.3769, longitude: 8.5417),
        span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
    )

    enum SheetHeight { case peek, mid, tall }

    var sheetOffset: CGFloat {
        switch sheetHeight {
        case .peek: return UIScreen.main.bounds.height * 0.78
        case .mid:  return UIScreen.main.bounds.height * 0.52
        case .tall: return UIScreen.main.bounds.height * 0.15
        }
    }

    var body: some View {
        ZStack(alignment: .top) {

            // ── Map ──────────────────────────────────────────────────────
            MapView(vm: vm, region: $mapRegion)
                .ignoresSafeArea()

            // ── Sun overlay on map ───────────────────────────────────────
            SunOverlayView(vm: vm)
                .ignoresSafeArea()
                .allowsHitTesting(false)

            // ── Search bar ───────────────────────────────────────────────
            SearchBarView(vm: vm, isActive: $showSearch, mapRegion: $mapRegion)
                .padding(.horizontal, 12)
                .padding(.top, 8)
                .zIndex(5)

            // ── Status pill ──────────────────────────────────────────────
            StatusPillView(vm: vm)
                .padding(.top, 70)
                .zIndex(4)

            // ── Locate button ────────────────────────────────────────────
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button(action: { vm.requestLocation() }) {
                        Image(systemName: "location.fill")
                            .font(.system(size: 18))
                            .foregroundColor(.sfText)
                            .frame(width: 46, height: 46)
                            .background(.white)
                            .clipShape(Circle())
                            .shadow(color: .black.opacity(0.18), radius: 12, x: 0, y: 2)
                    }
                    .padding(.trailing, 14)
                    .padding(.bottom, sheetOffset - UIScreen.main.bounds.height * 0.52 + 220)
                }
            }
            .zIndex(3)

            // ── Bottom sheet ─────────────────────────────────────────────
            BottomSheetView(vm: vm, height: $sheetHeight, showImpressum: $showImpressum)
                .offset(y: sheetOffset)
                .gesture(
                    DragGesture()
                        .onEnded { val in
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                if val.translation.height < -60 {
                                    sheetHeight = sheetHeight == .peek ? .mid : .tall
                                } else if val.translation.height > 60 {
                                    sheetHeight = sheetHeight == .tall ? .mid : .peek
                                }
                            }
                        }
                )
                .zIndex(2)
        }
        .sheet(isPresented: $showImpressum) { ImpressumView() }
        .onChange(of: vm.lat) { _ in
            withAnimation {
                mapRegion.center = CLLocationCoordinate2D(latitude: vm.lat, longitude: vm.lng)
            }
        }
    }
}

// ── Map View ──────────────────────────────────────────────────────────────────

struct MapView: UIViewRepresentable {
    @ObservedObject var vm: AppViewModel
    @Binding var region: MKCoordinateRegion

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.mapType = .standard
        mapView.showsBuildings = true
        mapView.showsUserLocation = true
        mapView.setRegion(region, animated: false)
        mapView.delegate = context.coordinator

        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        mapView.addGestureRecognizer(tap)
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        // Update region if changed from outside
        let cur = mapView.region.center
        if abs(cur.latitude - region.center.latitude) > 0.001 ||
           abs(cur.longitude - region.center.longitude) > 0.001 {
            mapView.setRegion(region, animated: true)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(vm: vm, region: $region) }

    class Coordinator: NSObject, MKMapViewDelegate {
        let vm: AppViewModel
        @Binding var region: MKCoordinateRegion
        var annotation: MKPointAnnotation?

        init(vm: AppViewModel, region: Binding<MKCoordinateRegion>) {
            self.vm = vm; self._region = region
        }

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let mapView = gesture.view as? MKMapView else { return }
            let pt = gesture.location(in: mapView)
            let coord = mapView.convert(pt, toCoordinateFrom: mapView)

            // Update VM
            Task { @MainActor in
                self.vm.lat = coord.latitude
                self.vm.lng = coord.longitude
                self.vm.update()

                // Reverse geocode
                let geocoder = CLGeocoder()
                let loc = CLLocation(latitude: coord.latitude, longitude: coord.longitude)
                geocoder.reverseGeocodeLocation(loc) { placemarks, _ in
                    Task { @MainActor in
                        self.vm.locationName = placemarks?.first?.locality
                            ?? placemarks?.first?.name
                            ?? String(format: "%.4f, %.4f", coord.latitude, coord.longitude)
                    }
                }

                // Move pin
                if let ann = self.annotation { mapView.removeAnnotation(ann) }
                let ann = MKPointAnnotation()
                ann.coordinate = coord
                mapView.addAnnotation(ann)
                self.annotation = ann
            }
        }

        func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
            region = mapView.region
        }
    }
}

// ── Sun Overlay (canvas-like warm glow) ──────────────────────────────────────

struct SunOverlayView: View {
    @ObservedObject var vm: AppViewModel

    var body: some View {
        GeometryReader { geo in
            if vm.sunPos.isUp {
                // Warm radial glow = sunny zone feel
                RadialGradient(
                    colors: [
                        sunColor.opacity(sunAlpha),
                        sunColor.opacity(sunAlpha * 0.5),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: max(geo.size.width, geo.size.height) * 0.65
                )
                .blendMode(.multiply)
            } else {
                // Night: dark blue overlay
                Color.sfDark.opacity(0.55)
            }
        }
        .animation(.easeInOut(duration: 0.5), value: vm.sunPos.isUp)
        .animation(.easeInOut(duration: 0.5), value: vm.sunStrength)
    }

    var sunColor: Color {
        let s = vm.sunStrength
        // low sun = orange, high sun = yellow
        return Color(
            red: 1.0,
            green: 0.7 + s * 0.24,
            blue: 0.12 + s * 0.08
        )
    }

    var sunAlpha: Double {
        vm.sunPos.isUp ? (0.18 + vm.sunStrength * 0.17) : 0
    }
}
