import { askLottiAction } from "../actions/lotti";
import { LottiLiveScreen } from "../../components/lotti-live-screen";

export default function LottiLivePage() {
  return <LottiLiveScreen askLottiAction={askLottiAction} />;
}
