import SouthernClass377 from './systems/rolling-stock/SNClass377'
import ThameslinkClass700 from './systems/rolling-stock/TLClass700'
import TrainAnnouncementSystem from './TrainAnnouncementSystem'

export const AllTrainAnnouncementSystems: { new (): TrainAnnouncementSystem }[] = [ThameslinkClass700, SouthernClass377]
