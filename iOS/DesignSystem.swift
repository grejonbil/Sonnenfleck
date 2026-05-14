import SwiftUI

// ── Design Tokens ────────────────────────────────────────────────────────────

extension Color {
    static let sfYellow  = Color(red: 0.961, green: 0.773, blue: 0.094) // #F5C518
    static let sfOrange  = Color(red: 0.910, green: 0.537, blue: 0.239) // #E8893D
    static let sfSky     = Color(red: 0.290, green: 0.608, blue: 0.780) // #4A9BC7
    static let sfDark    = Color(red: 0.102, green: 0.165, blue: 0.227) // #1A2A3A
    static let sfBg      = Color(red: 1.000, green: 0.976, blue: 0.941) // #FFF9F0
    static let sfSurface = Color(red: 1.000, green: 0.976, blue: 0.941).opacity(0.97)
    static let sfBorder  = Color(red: 0.878, green: 0.831, blue: 0.784) // #E0D4C8
    static let sfText    = Color(red: 0.102, green: 0.102, blue: 0.180) // #1A1A2E
    static let sfMuted   = Color(red: 0.478, green: 0.478, blue: 0.541) // #7A7A8A
}

// ── Sun Model ────────────────────────────────────────────────────────────────

struct SunPosition {
    let altitude: Double   // radians
    let azimuth: Double    // radians (SunCalc: 0=S, ±π=N)
    var altitudeDeg: Double { altitude * 180 / .pi }
    var azimuthDeg: Double  { ((azimuth * 180 / .pi) + 180 + 360).truncatingRemainder(dividingBy: 360) }
    var isUp: Bool          { altitude > 0.017 } // > ~1°
}

struct SunTimes {
    let sunrise: Date
    let sunset: Date
}

// ── Sun Calculator ───────────────────────────────────────────────────────────

struct SunCalc {

    // Julian date
    private static func toJulian(_ date: Date) -> Double {
        date.timeIntervalSince1970 / 86400.0 + 2440587.5
    }
    private static func fromJulian(_ j: Double) -> Date {
        Date(timeIntervalSince1970: (j - 2440587.5) * 86400.0)
    }
    private static func toDays(_ date: Date) -> Double {
        toJulian(date) - 2451545.0
    }

    private static let rad = Double.pi / 180

    private static func solarMeanAnomaly(_ d: Double) -> Double {
        (357.5291 + 0.98560028 * d) * rad
    }
    private static func eclipticLongitude(_ M: Double) -> Double {
        let C = (1.9148 * sin(M) + 0.0200 * sin(2*M) + 0.0003 * sin(3*M)) * rad
        let P = 102.9372 * rad
        return M + C + P + .pi
    }
    private static func declination(_ l: Double) -> Double {
        asin(sin(l) * sin(23.4397 * rad))
    }
    private static func rightAscension(_ l: Double) -> Double {
        atan2(sin(l) * cos(23.4397 * rad), cos(l))
    }
    private static func siderealTime(_ d: Double, _ lw: Double) -> Double {
        (280.16 + 360.9856235 * d) * rad - lw
    }
    private static func azimuth(_ H: Double, _ phi: Double, _ dec: Double) -> Double {
        atan2(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi))
    }
    private static func altitude(_ H: Double, _ phi: Double, _ dec: Double) -> Double {
        asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H))
    }

    static func getPosition(date: Date, lat: Double, lng: Double) -> SunPosition {
        let lw  = -lng * rad
        let phi =  lat * rad
        let d   = toDays(date)
        let M   = solarMeanAnomaly(d)
        let L   = eclipticLongitude(M)
        let dec = declination(L)
        let ra  = rightAscension(L)
        let H   = siderealTime(d, lw) - ra
        return SunPosition(
            altitude: altitude(H, phi, dec),
            azimuth:  azimuth(H, phi, dec)
        )
    }

    private static func julianCycle(_ d: Double, _ lw: Double) -> Double {
        (d - 0.0009 - lw / (2 * .pi)).rounded()
    }
    private static func approxTransit(_ Ht: Double, _ lw: Double, _ n: Double) -> Double {
        0.0009 + (Ht + lw) / (2 * .pi) + n
    }
    private static func solarTransitJ(_ ds: Double, _ M: Double, _ L: Double) -> Double {
        2451545.0 + ds + 0.0053 * sin(M) - 0.0069 * sin(2 * L)
    }
    private static func hourAngle(_ h: Double, _ phi: Double, _ d: Double) -> Double {
        acos((sin(h) - sin(phi) * sin(d)) / (cos(phi) * cos(d)))
    }

    static func getTimes(date: Date, lat: Double, lng: Double) -> SunTimes {
        let lw  = -lng * rad
        let phi =  lat * rad
        let d   = toDays(date)
        let n   = julianCycle(d, lw)
        let ds  = approxTransit(0, lw, n)
        let M   = solarMeanAnomaly(ds)
        let L   = eclipticLongitude(M)
        let dec = declination(L)
        let Jnoon = solarTransitJ(ds, M, L)
        let h0  = (-0.833) * rad
        let Jset: Double
        let Jrise: Double
        do {
            let w0 = hourAngle(h0, phi, dec)
            let a  = approxTransit(w0, lw, n)
            Jset  = solarTransitJ(a, M, L)
            Jrise = Jnoon - (Jset - Jnoon)
        }
        return SunTimes(
            sunrise: fromJulian(Jrise),
            sunset:  fromJulian(Jset)
        )
    }
}

// ── Favourite ────────────────────────────────────────────────────────────────

struct Favourite: Identifiable, Codable, Equatable {
    let id: UUID
    var name: String
    var lat: Double
    var lng: Double
    init(id: UUID = UUID(), name: String, lat: Double, lng: Double) {
        self.id = id; self.name = name; self.lat = lat; self.lng = lng
    }
}

// ── Activity ─────────────────────────────────────────────────────────────────

enum Activity: String, CaseIterable, Identifiable {
    case beer    = "🍺 Feierabendbier"
    case swim    = "🏊 Seebad"
    case tea     = "☕ Wintertee"
    case hike    = "🥾 Wanderung"
    case camping = "⛺ Zelten"
    var id: String { rawValue }
    var minAltitudeDeg: Double {
        switch self {
        case .beer:    return 5
        case .swim:    return 20
        case .tea:     return 2
        case .hike:    return 8
        case .camping: return -5
        }
    }
    var emoji: String { String(rawValue.prefix(2)) }
}
