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
  logo: null,
  tokenPlantsIcon: null,
  tokenUsdtIcon: null,
  tokenGemsIcon: null,

  // Summary Tab
  summaryHeroBanner: null,
  summaryFlowStep1: null,
  summaryFlowStep2: null,
  summaryFlowStep3: null,
  summaryFlowStep4: null,
  summaryPackPioneer: null,
  summaryPackChampion: null,
  summaryPackLegend: null,

  // Presale Tab
  presaleHeroBanner: null,
  presalePackPioneer: null,
  presalePackChampion: null,
  presalePackLegend: null,
  presaleHowStep1: null,
  presaleHowStep2: null,
  presaleHowStep3: null,
  presaleHowStep4: null,
  presaleBottomPromo: null,

  // Vesting Tab
  vestingHeroBanner: null,
  vestingWalletPioneer: null,
  vestingWalletChampion: null,
  vestingWalletLegend: null,

  // Swap Tab
  swapHeroBanner: null,
  swapSuperSinkImage: null,

  // Tokenomics Tab
  tokenomicsHeroBanner: null,
  tokenomicsFlowUsdt: null,
  tokenomicsFlowGems: null,
  tokenomicsFlowPool: null,
  tokenomicsFlowPlants: null,
  tokenomicsFlowSwap: null,
  tokenomicsFlowBurn: null,

  // Guide Tab
  guideHeroBanner: null,
  guideStep1Image: null,
  guideStep2Image: null,
  guideStep3Image: null,
  guideStep4Image: null,
  guideStep5Image: null,
}
