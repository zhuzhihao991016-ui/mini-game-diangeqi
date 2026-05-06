import { getGameSettings } from '../state/SettingsState'

export const APPEARANCE_THEMES = [
  {
    id: 'minimal',
    name: '清简素白',
    philosophy: 'Measured Silence',
    colors: {
      background: '#F7FAFC',
      surface: '#FFFFFF',
      surfaceTint: '#EEF2F6',
      line: '#D5DEE8',
      text: '#162231',
      muted: '#647386',
      primary: '#1B7AE8',
      primaryLight: '#E5F1FF',
      secondary: '#20A36A',
      secondaryLight: '#E2F7ED',
      warning: '#F6B73C',
      warningLight: '#FFF1C9',
      danger: '#E6504F',
      dangerLight: '#FFE6E4',
      purple: '#7357D9',
      purpleLight: '#EEE9FF',
      disabled: '#D8DFE7',
      obstacle: '#9AA7B5',
      dot: '#111827',
      p1: '#1B7AE8',
      p2: '#E6504F'
    },
    board: {
      emptyEdge: '#C9D5E2',
      dot: '#111827',
      highlight: '#F6B73C',
      obstacle: '#9AA7B5',
      cellAlpha: 0.2,
      claimedWidth: 6,
      emptyWidth: 3,
      dotRadius: 5,
      pattern: 'pin'
    },
    buttonStyle: 'minimal',
    background: { pattern: 'pin', imageAsset: 'themeBgMinimal', imageOverlay: 'rgba(255,255,255,0.08)' }
  },
  {
    id: 'mechanical',
    name: '钢芯矩阵',
    philosophy: 'Machined Grid',
    colors: {
      background: '#121820',
      surface: '#1D2630',
      surfaceTint: '#25313D',
      line: '#3C4A59',
      text: '#EAF1F7',
      muted: '#9AA8B5',
      primary: '#39B8FF',
      primaryLight: '#173A4F',
      secondary: '#6EE7B7',
      secondaryLight: '#173D35',
      warning: '#FFB547',
      warningLight: '#44351B',
      danger: '#FF6666',
      dangerLight: '#462123',
      purple: '#A78BFA',
      purpleLight: '#30284C',
      disabled: '#4A5662',
      obstacle: '#7C8794',
      dot: '#EAF1F7',
      p1: '#39B8FF',
      p2: '#FF6666'
    },
    board: {
      emptyEdge: '#46576A',
      dot: '#D7E3EF',
      highlight: '#FFB547',
      obstacle: '#7C8794',
      cellAlpha: 0.3,
      claimedWidth: 7,
      emptyWidth: 3,
      dotRadius: 4,
      pattern: 'circuit'
    },
    buttonStyle: 'mechanical',
    background: { pattern: 'circuit', imageAsset: 'themeBgMechanical', imageOverlay: 'rgba(10,16,24,0.28)' }
  },
  {
    id: 'steampunk',
    name: '铜炉齿轮',
    philosophy: 'Brass Pressure',
    colors: {
      background: '#2A2118',
      surface: '#3A2B1D',
      surfaceTint: '#4B3826',
      line: '#775B3C',
      text: '#FFF0D2',
      muted: '#C7A97C',
      primary: '#C9822A',
      primaryLight: '#5A3D23',
      secondary: '#6E9F72',
      secondaryLight: '#33482F',
      warning: '#E8B858',
      warningLight: '#5B4420',
      danger: '#C94F3D',
      dangerLight: '#55271F',
      purple: '#B58A55',
      purpleLight: '#4D3A28',
      disabled: '#6B5A47',
      obstacle: '#A58A63',
      dot: '#F5D08A',
      p1: '#E0A642',
      p2: '#C94F3D'
    },
    board: {
      emptyEdge: '#8B6B45',
      dot: '#F5D08A',
      highlight: '#E8B858',
      obstacle: '#A58A63',
      cellAlpha: 0.32,
      claimedWidth: 7,
      emptyWidth: 3,
      dotRadius: 5,
      pattern: 'rivets'
    },
    buttonStyle: 'steampunk',
    background: { pattern: 'rivets', imageAsset: 'themeBgSteampunk', imageOverlay: 'rgba(42,33,24,0.26)' }
  },
  {
    id: 'black-gold',
    name: '黑曜鎏金',
    philosophy: 'Imperial Night',
    colors: {
      background: '#080808',
      surface: '#15120B',
      surfaceTint: '#211B10',
      line: '#4C3D1D',
      text: '#FFF6D8',
      muted: '#BDAA74',
      primary: '#D6A735',
      primaryLight: '#33270E',
      secondary: '#D0C08A',
      secondaryLight: '#2B2718',
      warning: '#F5D36A',
      warningLight: '#3B2E12',
      danger: '#B94848',
      dangerLight: '#351818',
      purple: '#8D6B2E',
      purpleLight: '#2C2110',
      disabled: '#4A4434',
      obstacle: '#74684C',
      dot: '#F5D36A',
      p1: '#F5C542',
      p2: '#B94848'
    },
    board: {
      emptyEdge: '#59461E',
      dot: '#F5D36A',
      highlight: '#FFF1A8',
      obstacle: '#74684C',
      cellAlpha: 0.34,
      claimedWidth: 7,
      emptyWidth: 3,
      dotRadius: 5,
      pattern: 'luxury'
    },
    buttonStyle: 'black-gold',
    background: { pattern: 'luxury', imageAsset: 'themeBgBlackGold', imageOverlay: 'rgba(0,0,0,0.36)' }
  },
  {
    id: 'cartoon',
    name: '糖果乐园',
    philosophy: 'Bright Play',
    colors: {
      background: '#FFF7D9',
      surface: '#FFFFFF',
      surfaceTint: '#FFEEC2',
      line: '#FFD07A',
      text: '#3B2B25',
      muted: '#8B6A58',
      primary: '#2E9BFF',
      primaryLight: '#DDF0FF',
      secondary: '#33C46D',
      secondaryLight: '#E4F9E9',
      warning: '#FFCC3E',
      warningLight: '#FFF1B9',
      danger: '#FF5A5F',
      dangerLight: '#FFE1E1',
      purple: '#A66CFF',
      purpleLight: '#F0E5FF',
      disabled: '#E5D6B8',
      obstacle: '#B79C78',
      dot: '#3B2B25',
      p1: '#2E9BFF',
      p2: '#FF5A5F'
    },
    board: {
      emptyEdge: '#F2B85A',
      dot: '#3B2B25',
      highlight: '#FFCC3E',
      obstacle: '#B79C78',
      cellAlpha: 0.28,
      claimedWidth: 8,
      emptyWidth: 4,
      dotRadius: 6,
      pattern: 'confetti'
    },
    buttonStyle: 'cartoon',
    background: { pattern: 'confetti', imageAsset: 'themeBgCartoon', imageOverlay: 'rgba(255,255,255,0.10)' }
  },
  {
    id: 'guofeng',
    name: '丹青山河',
    philosophy: 'Ink Territory',
    colors: {
      background: '#F5F0E6',
      surface: '#FFFDF6',
      surfaceTint: '#EEE4D1',
      line: '#D4C4A4',
      text: '#2D2620',
      muted: '#776A5A',
      primary: '#A72D2D',
      primaryLight: '#F4DED8',
      secondary: '#1D7A66',
      secondaryLight: '#DCEDE6',
      warning: '#C99B36',
      warningLight: '#F5E8C7',
      danger: '#8F2F2D',
      dangerLight: '#ECD8D2',
      purple: '#5E4B7A',
      purpleLight: '#E6DFED',
      disabled: '#D8CCB8',
      obstacle: '#8F836F',
      dot: '#2D2620',
      p1: '#A72D2D',
      p2: '#1D7A66'
    },
    board: {
      emptyEdge: '#BCA982',
      dot: '#2D2620',
      highlight: '#C99B36',
      obstacle: '#8F836F',
      cellAlpha: 0.26,
      claimedWidth: 6,
      emptyWidth: 3,
      dotRadius: 5,
      pattern: 'ink'
    },
    buttonStyle: 'guofeng',
    background: { pattern: 'ink', imageAsset: 'themeBgGuofeng', imageOverlay: 'rgba(245,240,230,0.18)' }
  },
  {
    id: 'handdrawn',
    name: '铅笔手札',
    philosophy: 'Sketchbook Play',
    colors: {
      background: '#FFF8EA',
      surface: '#FFFDF7',
      surfaceTint: '#F3E8D4',
      line: '#D8C7AA',
      text: '#3B3029',
      muted: '#7E6B5D',
      primary: '#4378D0',
      primaryLight: '#E4EEFF',
      secondary: '#5EA86E',
      secondaryLight: '#E5F4E6',
      warning: '#E7AC37',
      warningLight: '#FFF0C8',
      danger: '#D85D50',
      dangerLight: '#FFE2DD',
      purple: '#9567C7',
      purpleLight: '#F0E4FA',
      disabled: '#D9CCB8',
      obstacle: '#A8947D',
      dot: '#3B3029',
      p1: '#4378D0',
      p2: '#D85D50'
    },
    board: {
      emptyEdge: '#BDAF9B',
      dot: '#3B3029',
      highlight: '#E7AC37',
      obstacle: '#A8947D',
      cellAlpha: 0.27,
      claimedWidth: 6,
      emptyWidth: 3,
      dotRadius: 5,
      pattern: 'sketch'
    },
    buttonStyle: 'handdrawn',
    background: { pattern: 'sketch', imageAsset: 'themeBgHanddrawn', imageOverlay: 'rgba(255,248,234,0.20)' }
  },
  {
    id: 'panda',
    name: '熊猫竹影',
    philosophy: 'Bamboo Smile',
    colors: {
      background: '#EFF8E9',
      surface: '#FFFFFF',
      surfaceTint: '#DFF1D7',
      line: '#BBD8AC',
      text: '#253027',
      muted: '#62745D',
      primary: '#2F8F4E',
      primaryLight: '#DFF5E5',
      secondary: '#6ABF4B',
      secondaryLight: '#E7F7DD',
      warning: '#F2BE45',
      warningLight: '#FFF1C8',
      danger: '#EC6A5C',
      dangerLight: '#FFE2DD',
      purple: '#6F8BD7',
      purpleLight: '#E6EDFF',
      disabled: '#C8D7C1',
      obstacle: '#8FA17F',
      dot: '#1F2521',
      p1: '#2F8F4E',
      p2: '#EC6A5C'
    },
    board: {
      emptyEdge: '#9AC38A',
      dot: '#1F2521',
      highlight: '#F2BE45',
      obstacle: '#8FA17F',
      cellAlpha: 0.3,
      claimedWidth: 7,
      emptyWidth: 4,
      dotRadius: 6,
      pattern: 'bamboo'
    },
    buttonStyle: 'panda',
    background: { pattern: 'bamboo', imageAsset: 'themeBgPanda', imageOverlay: 'rgba(239,248,233,0.16)' }
  }
]

const DEFAULT_THEME = APPEARANCE_THEMES[0]

export function getAppearanceThemeById(id) {
  return APPEARANCE_THEMES.find(theme => theme.id === id) || DEFAULT_THEME
}

export function getActiveAppearanceTheme() {
  return getAppearanceThemeById(getGameSettings().appearanceThemeId)
}

export function getAppearanceColors() {
  return getActiveAppearanceTheme().colors
}

export function getAppearanceThemeOptions() {
  return APPEARANCE_THEMES
}
