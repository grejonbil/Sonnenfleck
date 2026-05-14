import SwiftUI
import Combine
import CoreLocation

// ── App State ────────────────────────────────────────────────────────────────

@MainActor
class AppViewModel: NSObject, ObservableObject {

    // ── State ──────────────────────────────────────────────────────────────

    @Published var locationName: String      = "Zürich"
    @Published var lat: Double               = 47.3769
    @Published var lng: Double               = 8.5417
    @Published var selectedDate: Date        = Date()
    @Published var sliderHour: Double        = Double(Calendar.current.component(.hour, from: Date())) + Double(Calendar.current.component(.minute, from: Date())) / 60.0
    @Published var sunPos: SunPosition       = SunPosition(altitude: 0, azimuth: 0)
    @Published var sunTimes: SunTimes?       = nil
    @Published var selectedActivity: Activity = .beer
    @Published var favourites: [Favourite]   = []
    @Published var isAnimating: Bool         = false
    @Published var animSpeed: Double         = 1.0
    @Published var showFavourites: Bool      = false
    @Published var locationStatus: String    = ""

    // ── Private ────────────────────────────────────────────────────────────

    private var animTimer: Timer?
    private let locationManager = CLLocationManager()
    private let favKey = "sonnenfleck.favourites"

    // ── Init ───────────────────────────────────────────────────────────────

    override init() {
        super.init()
        locationManager.delegate = self
        loadFavourites()
        update()
    }

    // ── Computed ───────────────────────────────────────────────────────────

    var currentDate: Date {
        var comps = Calendar.current.dateComponents([.year, .month, .day], from: selectedDate)
        let h = Int(sliderHour)
        let m = Int((sliderHour - Double(h)) * 60)
        comps.hour   = h
        comps.minute = m
        comps.second = 0
        return Calendar.current.date(from: comps) ?? Date()
    }

    var hasSun: Bool {
        sunPos.isUp && sunPos.altitudeDeg >= selectedActivity.minAltitudeDeg
    }

    var statusEmoji: String {
        guard sunPos.isUp else { return "🌙" }
        return hasSun ? "☀️" : "🌑"
    }

    var statusText: String {
        guard sunPos.isUp else { return "Nacht" }
        return hasSun ? "In der Sonne" : "Im Schatten"
    }

    var statusColor: Color {
        guard sunPos.isUp else { return .sfDark }
        return hasSun ? .sfYellow : Color(red: 0.78, green: 0.82, blue: 0.87)
    }

    var statusTextColor: Color {
        hasSun ? .sfDark : .sfText
    }

    var sunriseText: String {
        guard let t = sunTimes else { return "--:--" }
        return timeString(t.sunrise)
    }

    var sunsetText: String {
        guard let t = sunTimes else { return "--:--" }
        return timeString(t.sunset)
    }

    var minutesUntilChange: Int? {
        guard let t = sunTimes, sunPos.isUp else { return nil }
        let now = currentDate
        if hasSun {
            let diff = t.sunset.timeIntervalSince(now)
            return diff > 0 ? Int(diff / 60) : nil
        } else {
            return nil
        }
    }

    var timeDisplayString: String {
        let h = Int(sliderHour)
        let m = Int((sliderHour - Double(h)) * 60)
        return String(format: "%02d:%02d", h, m)
    }

    var sunStrength: Double {
        guard sunPos.isUp else { return 0 }
        return min(1.0, sunPos.altitudeDeg / 45.0)
    }

    // ── Update ─────────────────────────────────────────────────────────────

    func update() {
        let date = currentDate
        sunPos   = SunCalc.getPosition(date: date, lat: lat, lng: lng)
        sunTimes = SunCalc.getTimes(date: date, lat: lat, lng: lng)
    }

    func setHour(_ h: Double) {
        sliderHour = h
        update()
    }

    func setToNow() {
        sliderHour = Double(Calendar.current.component(.hour, from: Date()))
            + Double(Calendar.current.component(.minute, from: Date())) / 60.0
        selectedDate = Date()
        update()
    }

    // ── Animation ──────────────────────────────────────────────────────────

    func toggleAnimation() {
        if isAnimating { stopAnimation() } else { startAnimation() }
    }

    private func startAnimation() {
        isAnimating = true
        if sliderHour >= 22 { sliderHour = 6 }
        let interval = 0.05 / animSpeed
        animTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                if self.sliderHour >= 22 {
                    self.stopAnimation()
                } else {
                    self.sliderHour = min(22, self.sliderHour + 0.1)
                    self.update()
                }
            }
        }
    }

    private func stopAnimation() {
        isAnimating = false
        animTimer?.invalidate()
        animTimer = nil
    }

    // ── Location ───────────────────────────────────────────────────────────

    func requestLocation() {
        locationStatus = "Standort wird ermittelt…"
        locationManager.requestWhenInUseAuthorization()
        locationManager.requestLocation()
    }

    func setLocation(lat: Double, lng: Double, name: String) {
        self.lat = lat
        self.lng = lng
        self.locationName = name
        update()
    }

    // ── Favourites ─────────────────────────────────────────────────────────

    func toggleFavourite() {
        if let idx = favourites.firstIndex(where: { abs($0.lat - lat) < 0.001 && abs($0.lng - lng) < 0.001 }) {
            favourites.remove(at: idx)
        } else {
            favourites.append(Favourite(name: locationName, lat: lat, lng: lng))
        }
        saveFavourites()
    }

    var isCurrentFavourite: Bool {
        favourites.contains { abs($0.lat - lat) < 0.001 && abs($0.lng - lng) < 0.001 }
    }

    func selectFavourite(_ fav: Favourite) {
        setLocation(lat: fav.lat, lng: fav.lng, name: fav.name)
    }

    func deleteFavourite(_ fav: Favourite) {
        favourites.removeAll { $0.id == fav.id }
        saveFavourites()
    }

    private func saveFavourites() {
        if let data = try? JSONEncoder().encode(favourites) {
            UserDefaults.standard.set(data, forKey: favKey)
        }
    }

    private func loadFavourites() {
        guard let data = UserDefaults.standard.data(forKey: favKey),
              let favs = try? JSONDecoder().decode([Favourite].self, from: data) else { return }
        favourites = favs
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private func timeString(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        f.timeZone = TimeZone(identifier: "Europe/Zurich")
        return f.string(from: date)
    }
}

// ── CLLocationManagerDelegate ─────────────────────────────────────────────────

extension AppViewModel: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locs: [CLLocation]) {
        guard let loc = locs.first else { return }
        Task { @MainActor in
            self.lat = loc.coordinate.latitude
            self.lng = loc.coordinate.longitude
            self.locationStatus = ""
            self.update()
            // Reverse geocode
            let geocoder = CLGeocoder()
            let clLoc = CLLocation(latitude: loc.coordinate.latitude, longitude: loc.coordinate.longitude)
            geocoder.reverseGeocodeLocation(clLoc) { placemarks, _ in
                Task { @MainActor in
                    if let name = placemarks?.first?.locality ?? placemarks?.first?.name {
                        self.locationName = name
                    }
                }
            }
        }
    }
    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.locationStatus = "" }
    }
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            if manager.authorizationStatus == .authorizedWhenInUse ||
               manager.authorizationStatus == .authorizedAlways {
                manager.requestLocation()
            }
        }
    }
}
