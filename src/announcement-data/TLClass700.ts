import TrainAnnouncementSystem, { OptionsExplanation } from './TrainAnnouncementSystem'

interface IApproachingStationAnnouncementOptions {
  isAto: boolean
  exchangePOIs: string[]
}

export default class TLClass700 extends TrainAnnouncementSystem {
  readonly NAME = 'Thameslink Class 700'
  readonly ID = 'TL_CLASS_700_V1'
  readonly FILE_PREFIX = 'TL/700'
  readonly SYSTEM_TYPE = 'train'

  async playApproachingStationAnnouncement(stationCode: string, options: IApproachingStationAnnouncementOptions): Promise<void> {
    const files: Parameters<typeof this['playAudioFiles']>[0] = ['we will shortly be arriving at', `stations.low.${stationCode}`]

    if (options.exchangePOIs.length > 0) {
      files.push('change here for')
    }
    options.exchangePOIs.forEach((poi, i) => files.push({ id: `exchange-locations.${poi}`, opts: { delayStart: i === 0 ? 100 : 0 } }))

    if (options.isAto) {
      files.push('the doors will open automatically at the next station')
    }

    await this.playAudioFiles(files)
  }

  readonly approachingStationAnnouncementOptions: Record<
    keyof Parameters<typeof this.playApproachingStationAnnouncement>[1],
    OptionsExplanation
  > = {
    isAto: {
      name: 'Automatic train operation?',
      default: false,
      type: 'boolean',
    },
    exchangePOIs: {
      name: 'Exchange POIs',
      type: 'multiselect',
      options: [{ title: 'St Pauls Cathedral', value: 'st pauls cathedral' }],
      default: [],
    },
  }

  readonly AvailableStationNames = {
    high: [
      'BAB',
      'BDK',
      'BFR',
      'BTN',
      'BUG',
      'CTK',
      'ECR',
      'ELS',
      'FLT',
      'FPK',
      'GTW',
      'HHE',
      'HIT',
      'HLN',
      'HPD',
      'HSK',
      'LBG',
      'LEA',
      'LET',
      'LTN',
      'LUT',
      'MIL',
      'PRP',
      'RDT',
      'RYS',
      'SAC',
      'STP',
      'SVG',
      'TBG',
      'WVF',
      'ZFD',
    ],
    low: ['BDM', 'BFR', 'BTN', 'BUG', 'CBG', 'CTK', 'HSK', 'LUT', 'PRP', 'WVF'],
  }
}
