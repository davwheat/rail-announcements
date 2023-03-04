import ThameslinkClass700 from './systems/rolling-stock/TLClass700'
import BombardierXstar from './systems/rolling-stock/BombardierXstar'
import TfWTrainFx from './systems/rolling-stock/TfWTrainFx'

import KeTechPhil from './systems/stations/KeTechPhil'
import KeTechCelia from './systems/stations/KeTechCelia'
import AtosMatt from './systems/stations/AtosMatt'
import AtosAnne from './systems/stations/AtosAnne'
import ScotRail from './systems/stations/ScotRail'

import TfLJubileeLine from './systems/rolling-stock/TfLJubileeLine'
import TfLNorthernLine from './systems/rolling-stock/TfLNorthernLine'

import TrainAnnouncementSystem from './TrainAnnouncementSystem'
import StationAnnouncementSystem from './StationAnnouncementSystem'
import AnnouncementSystem from './AnnouncementSystem'
import TfLElizabethLine from './systems/rolling-stock/TfLElizabeth'

export const AllTrainAnnouncementSystems: { new (): TrainAnnouncementSystem }[] = [ThameslinkClass700, BombardierXstar, TfWTrainFx]

export const AllStationAnnouncementSystems: { new (): StationAnnouncementSystem }[] = [AtosMatt, AtosAnne, KeTechPhil, KeTechCelia, ScotRail]

export const AllOtherAnnouncementSystems: { new (): AnnouncementSystem }[] = [TfLJubileeLine, TfLNorthernLine, TfLElizabethLine]

export const AllAnnouncementSystems: { new (): TrainAnnouncementSystem | StationAnnouncementSystem | AnnouncementSystem }[] = [
  ...AllStationAnnouncementSystems,
  ...AllTrainAnnouncementSystems,
  ...AllOtherAnnouncementSystems,
]
