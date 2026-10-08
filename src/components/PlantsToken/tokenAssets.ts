// Registry of images/assets for the PLANTS Token section.
// When image files are provided, simply import them here or assign their paths/URLs.
// When null or undefined, the components render high-fidelity UI fallbacks with data-slot attributes.

export interface TokenAssetsRegistry {
  // Brand & Common
  logo?: string | null
  tokenPlantsIcon?: string | null
  tokenUsdtIcon?: string | null
  tokenGemsIcon?: string | null

  // Summary Tab
  summaryHeroBanner?: string | null
  summaryFlowStep1?: string | null
  summaryFlowStep2?: string | null
  summaryFlowStep3?: string | null
  summaryFlowStep4?: string | null
  summaryPackPioneer?: string | null
  summaryPackChampion?: string | null
  summaryPackLegend?: string | null

  // Presale Tab
  presaleHeroBanner?: string | null
  presalePackPioneer?: string | null
  presalePackChampion?: string | null
  presalePackLegend?: string | null
  presaleHowStep1?: string | null
  presaleHowStep2?: string | null
  presaleHowStep3?: string | null
  presaleHowStep4?: string | null
  presaleBottomPromo?: string | null

  // Vesting Tab
  vestingHeroBanner?: string | null
  vestingWalletPioneer?: string | null
  vestingWalletChampion?: string | null
  vestingWalletLegend?: string | null

  // Swap Tab
  swapHeroBanner?: string | null
  swapSuperSinkImage?: string | null

  // Tokenomics Tab
  tokenomicsHeroBanner?: string | null
  tokenomicsFlowUsdt?: string | null
  tokenomicsFlowGems?: string | null
  tokenomicsFlowPool?: string | null
  tokenomicsFlowPlants?: string | null
  tokenomicsFlowSwap?: string | null
  tokenomicsFlowBurn?: string | null

  // Guide Tab
  guideHeroBanner?: string | null
  guideStep1Image?: string | null
  guideStep2Image?: string | null
  guideStep3Image?: string | null
  guideStep4Image?: string | null
  guideStep5Image?: string | null
}

export const TOKEN_ASSETS: TokenAssetsRegistry = {
  // Brand & Common
  logo: '/game-assets/token/logo.webp',
  tokenPlantsIcon: null,
  tokenUsdtIcon: null,
  tokenGemsIcon: null,

  // Summary Tab
  summaryHeroBanner: '/game-assets/token/hero_summary.webp',
  summaryFlowStep1: null,
  summaryFlowStep2: null,
  summaryFlowStep3: null,
  summaryFlowStep4: null,
  summaryPackPioneer: '/game-assets/token/chest_pioneer.webp',
  summaryPackChampion: '/game-assets/token/chest_champion.webp',
  summaryPackLegend: '/game-assets/token/chest_legend.webp',

  // Presale Tab
  presaleHeroBanner: '/game-assets/token/hero_presale.webp',
  presalePackPioneer: '/game-assets/token/chest_pioneer.webp',
  presalePackChampion: '/game-assets/token/chest_champion.webp',
  presalePackLegend: '/game-assets/token/chest_legend.webp',
  presaleHowStep1: null,
  presaleHowStep2: null,
  presaleHowStep3: null,
  presaleHowStep4: null,
  presaleBottomPromo: null,

  // Vesting Tab
  vestingHeroBanner: '/game-assets/token/hero_vesting.webp',
  vestingWalletPioneer: '/game-assets/token/chest_pioneer.webp',
  vestingWalletChampion: '/game-assets/token/chest_champion.webp',
  vestingWalletLegend: '/game-assets/token/chest_legend.webp',

  // Swap Tab
  swapHeroBanner: '/game-assets/token/hero_swap.webp',
  swapSuperSinkImage: null,

  // Tokenomics Tab
  tokenomicsHeroBanner: '/game-assets/token/hero_tokenomics.webp',
  tokenomicsFlowUsdt: null,
  tokenomicsFlowGems: null,
  tokenomicsFlowPool: null,
  tokenomicsFlowPlants: null,
  tokenomicsFlowSwap: null,
  tokenomicsFlowBurn: null,

  // Guide Tab
  guideHeroBanner: '/game-assets/token/hero_summary.webp',
  guideStep1Image: null,
  guideStep2Image: null,
  guideStep3Image: null,
  guideStep4Image: null,
  guideStep5Image: null,
}
