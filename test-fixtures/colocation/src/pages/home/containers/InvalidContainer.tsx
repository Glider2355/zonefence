// Invalid: importing from sibling containers (should be flagged)
import { SettingsContainer } from "../../settings/containers/SettingsContainer";

export function InvalidContainer() {
	return <SettingsContainer />;
}
