// Invalid: importing from containers (should be flagged)
import { HomeContainer } from "../containers/HomeContainer";

export function InvalidPresenter() {
	return <HomeContainer />;
}
