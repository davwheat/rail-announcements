import SouthernClass377 from './systems/rolling-stock/SNClass377'
import ThameslinkClass700 from './systems/rolling-stock/TLClass700'

import KeTechPhil from './systems/stations/KeTechPhil'
import KeTechCelia from './systems/stations/KeTechCelia'
import AtosMatt from './systems/stations/AtosMatt'
import AtosAnne from './systems/stations/AtosAnne'

import TrainAnnouncementSystem from './TrainAnnouncementSystem'
import StationAnnouncementSystem from './StationAnnouncementSystem'

export const AllTrainAnnouncementSystems: { new (): TrainAnnouncementSystem }[] = [ThameslinkClass700, SouthernClass377]

export const AllStationAnnouncementSystems: { new (): StationAnnouncementSystem }[] = [AtosMatt, AtosAnne, KeTechPhil, KeTechCelia]

export const AllAnnouncementSystems: { new (): TrainAnnouncementSystem | StationAnnouncementSystem }[] = [
  ...AllStationAnnouncementSystems,
  ...AllTrainAnnouncementSystems,
]
