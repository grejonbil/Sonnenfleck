import SwiftUI

struct SplashView: View {
    var onFinish: () -> Void
    @State private var logoOffset: CGFloat = 0
    @State private var dotOpacity: [Double] = [0.3, 0.3, 0.3]
    @State private var dotScale:   [CGFloat] = [1, 1, 1]
    @State private var showButton  = false

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [
                    Color(red: 0.059, green: 0.114, blue: 0.169),
                    Color(red: 0.102, green: 0.188, blue: 0.314),
                    Color(red: 0.118, green: 0.239, blue: 0.361)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Logo
                SunLogoView(size: 120)
                    .offset(y: logoOffset)
                    .shadow(color: Color.sfYellow.opacity(0.4), radius: 32, x: 0, y: 8)
                    .onAppear { startFloatAnimation() }

                Spacer().frame(height: 28)

                // Title
                Text("SonnenFleck")
                    .font(.system(size: 38, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                    .tracking(-0.5)

                Spacer().frame(height: 6)

                // Tagline
                Text("Wo scheint die Sonne gerade?")
                    .font(.system(size: 17, weight: .regular))
                    .foregroundColor(.white.opacity(0.65))

                Spacer().frame(height: 40)

                // Loading dots
                HStack(spacing: 8) {
                    ForEach(0..<3, id: \.self) { i in
                        Circle()
                            .fill(Color.sfYellow)
                            .frame(width: 8, height: 8)
                            .opacity(dotOpacity[i])
                            .scaleEffect(dotScale[i])
                    }
                }
                .onAppear { startDotAnimation() }

                Spacer().frame(height: 12)

                Text("Gebäudedaten werden geladen…")
                    .font(.system(size: 13))
                    .foregroundColor(.white.opacity(0.35))

                Spacer().frame(height: 40)

                // CTA Button
                if showButton {
                    Button(action: onFinish) {
                        Text("Jetzt erkunden")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.sfDark)
                            .padding(.horizontal, 36)
                            .padding(.vertical, 14)
                            .background(Color.sfYellow)
                            .clipShape(Capsule())
                            .shadow(color: Color.sfYellow.opacity(0.45), radius: 24, x: 0, y: 4)
                    }
                    .buttonStyle(.plain)
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
                }

                Spacer()
            }
            .padding(.horizontal, 24)
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                    showButton = true
                }
            }
        }
    }

    private func startFloatAnimation() {
        withAnimation(
            .easeInOut(duration: 3)
            .repeatForever(autoreverses: true)
        ) {
            logoOffset = -8
        }
    }

    private func startDotAnimation() {
        for i in 0..<3 {
            let delay = Double(i) * 0.2
            Timer.scheduledTimer(withTimeInterval: 1.2, repeats: true) { _ in
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    withAnimation(.easeInOut(duration: 0.4)) {
                        dotOpacity[i] = 1.0
                        dotScale[i]   = 1.3
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + delay + 0.4) {
                        withAnimation(.easeInOut(duration: 0.4)) {
                            dotOpacity[i] = 0.3
                            dotScale[i]   = 1.0
                        }
                    }
                }
            }.fire()
        }
    }
}

// ── Sun Logo ──────────────────────────────────────────────────────────────────

struct SunLogoView: View {
    let size: CGFloat
    @State private var rotation: Double = 0

    var body: some View {
        ZStack {
            // Rays
            ForEach(0..<8, id: \.self) { i in
                Capsule()
                    .fill(Color.sfYellow)
                    .frame(width: size * 0.07, height: size * 0.22)
                    .offset(y: -(size * 0.44))
                    .rotationEffect(.degrees(Double(i) * 45 + rotation))
            }
            // Sun body – half sunny, half shaded
            Circle()
                .fill(Color.sfYellow)
                .frame(width: size * 0.6, height: size * 0.6)
            Circle()
                .fill(Color.sfDark.opacity(0.35))
                .frame(width: size * 0.6, height: size * 0.6)
                .mask(
                    HStack(spacing: 0) {
                        Color.clear
                        Color.black
                    }
                )
        }
        .frame(width: size, height: size)
        .onAppear {
            withAnimation(.linear(duration: 20).repeatForever(autoreverses: false)) {
                rotation = 360
            }
        }
    }
}
