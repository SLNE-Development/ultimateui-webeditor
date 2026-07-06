"use client";

import CreateUiDialog from "@/components/home/create-ui-dialog";
import HomeCard from "@/components/home/home-card";
import SelectPageDialog from "@/components/page/select-page-dialog";
import { Button } from "@/components/ui/button";
import { CirclePlus, ExternalLink, Pen } from "lucide-react";

export default function Home() {
	return (
		<div className="grid h-screen w-screen grid-cols-3 items-center justify-center gap-2 p-5">
			<HomeCard
				icon={<Pen />}
				title="Edit existing UI"
				description="Edit the UI you previously created in the editor by clicking here"
				button={
					<SelectPageDialog
						trigger={<Button>Edit</Button>}
						title="Edit existing UI"
						description="Pick one of your saved UIs to continue editing."
						mode="edit"
					/>
				}
			/>

			<HomeCard
				icon={<CirclePlus />}
				title="Create UI"
				description="Create a new UI that your players will be able to use while playing on the server"
				button={<CreateUiDialog trigger={<Button>Create</Button>} />}
			/>

			<HomeCard
				icon={<ExternalLink />}
				title="Open UI"
				description="Open the UI and see how it looks after finishing it in the editor"
				button={
					<SelectPageDialog
						trigger={<Button>Open</Button>}
						title="Open UI"
						description="Pick a saved UI to preview it like in game."
						mode="preview"
					/>
				}
			/>
		</div>
	);
}
