/**
 * GameFeelProfile
 * Centralized design tokens and animation constants for Stage 4 Game Feel & Presentation.
 * Eliminates magic numbers across Canvas rendering, DOM transitions, and audio timings.
 */
export const GameFeelProfile = {
  // 1. Piece Physicality & Layers
  piece: {
    // Edge thickness as fraction of cell size (3.5% of cellSize)
    edgeThicknessRatio: 0.038,
    edgeColorTop: '#F2ECE1',        // Light birch / cream top bevel
    edgeColorSide: '#DFD4C3',       // Warm cardboard side
    edgeColorBottom: '#C5B59E',     // Shaded bottom cardboard edge
    strokeWidth: 2.2,

    // Contact Shadow (Resting on table)
    restingShadowColor: 'rgba(55, 38, 22, 0.18)',
    restingShadowOffsetY: 4,
    restingShadowBlur: 9,

    // Lifted Shadow (In-flight under fingers)
    liftedShadowColor: 'rgba(55, 38, 22, 0.28)',
    liftedShadowOffsetY: 12,
    liftedShadowBlur: 22,

    // Scale & Visual Lift
    singleLiftScale: 1.05,
    groupLiftScale: 1.03,
    visualLiftY: -8,                // Pixels piece moves towards camera/finger
    liftDurationMs: 100,
    fingerTiltDeg: 1.2              // Subtle natural tilt when held
  },

  // 2. Magnetic Snap & Seam Glow
  snap: {
    magneticApproachMs: 80,
    snapAlignmentMs: 65,
    microOvershootScale: 1.035,
    overshootDurationMs: 50,
    settleDurationMs: 75,
    totalSnapDurationMs: 190,

    // Seam flare along connecting border
    seamGlowColor: 'rgba(255, 245, 192, 0.95)',
    seamGlowDurationMs: 110,
    seamGlowWidth: 4
  },

  // 3. Wrong Drop
  wrongDrop: {
    durationMs: 220,
    wobbleFrequency: 3,             // 3 lateral oscillations
    wobbleAmplitudePx: 8
  },

  // 4. Final Piece Ceremony (680ms total)
  finalCeremony: {
    // Phase 1: Final Snap & Micro Pop (0 ~ 120ms)
    snapDurationMs: 120,
    groupPopScale: 1.035,

    // Phase 2: Seam Convergence & Stroke Dissolve (120 ~ 260ms)
    seamDissolveStartMs: 120,
    seamDissolveDurationMs: 140,
    seamAlphaEnd: 0.15,

    // Phase 3: Master Dish Reveal & Glow (260 ~ 480ms)
    revealStartMs: 260,
    revealDurationMs: 220,
    revealScaleMax: 1.04,
    plateGlowColor: 'rgba(243, 201, 105, 0.55)',
    plateGlowBlur: 24,
    boardDimAlpha: 0.07,            // 7% subtle board dimming to focus dish

    // Phase 4: Floating Title Pill (320 ~ 580ms)
    titleStartMs: 320,
    titleDurationMs: 260,
    titleLiftPx: -16
  },

  // 5. Serve Transition (Dish lifts -> flies to receipt, 480 ~ 680ms)
  serve: {
    liftStartMs: 480,
    liftDurationMs: 60,
    liftHeightPx: -14,

    flightStartMs: 540,
    flightDurationMs: 140,
    flightScaleEnd: 0.38,
    flightMaxTiltDeg: 2.8,

    totalAnimDurationMs: 680,
    receiptThumbnailPopScale: 1.22,
    receiptDipY: 6
  },

  // 6. Receipt Transitions
  receipt: {
    sealStampDurationMs: 180,
    sealColor: 'rgba(192, 72, 56, 0.92)', // Traditional Cinnabar red
    sealTiltDeg: -8,
    pricePopScale: 1.18,
    tearDurationMs: 260,
    printDurationMs: 320
  },

  // 7. Revenue Feedback & Particle
  revenue: {
    flyDurationMs: 400,
    flyStartOffsetY: 10,
    color: '#E8B85C',
    glowColor: 'rgba(232, 184, 92, 0.6)',
    counterPopScale: 1.15
  },

  // 8. Board Visuals & Spawn Flow
  board: {
    pieceSpawnDurationMs: 260,
    pieceSpawnStaggerMs: 40,
    spawnBounceScale: 0.96,
    cameraPulseScale: 1.008,
    dayClearTransitionDelayMs: 450,
    dayClearFadeDurationMs: 700
  }
};
