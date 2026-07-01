"use client";

import HomeCard from "@/components/home/home-card";
import SelectPageDialog from "@/components/page/select-page-dialog";
import { Button } from "@/components/ui/button";
import { CirclePlus, ExternalLink, Pen } from "lucide-react";
import Link from "next/link";

export default function Home() {
	return (
		<div className="grid grid-cols-3 gap-2 justify-center items-center h-screen w-screen p-5">
			<HomeCard
				icon={<Pen />}
				title="Edit existing UI"
				description="Edit the UI you previously created in the editor by clicking here"
				button={
					<SelectPageDialog
						trigger={<Button>Edit</Button>}
						title="Edit existing UI"
						description="Edit the UI you previously created in the editor by clicking here"
						footer={<div />}
					/>
				}
			/>

			<HomeCard
				icon={<CirclePlus />}
				title="Create UI"
				description="Create a new UI that your players will be able to use while playing on the server"
				button={<Link href={"#"} />}
			/>

			<HomeCard
				icon={<ExternalLink />}
				title="Open UI"
				description="Open the UI and see how it looks after finishing it in the editor"
				button={
					<SelectPageDialog
						trigger={<Button>Edit</Button>}
						title="Open UI"
						description="Open the UI and see how it looks after finishing it in the editor"
						footer={<div />}
					/>
				}
			/>
		</div>
	);
}
