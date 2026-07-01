import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface HomeCardProps {
	icon: React.ReactElement;
	title: string;
	description: string;
	button: React.ReactElement;
}

export default function HomeCard({
	icon,
	title,
	description,
	button,
}: HomeCardProps) {
	return (
		<Card>
			<CardContent className="flex flex-col gap-2 items-center justify-center ">
				<span>{icon}</span>
				<h2 className="font-bold text-xl">{title}</h2>
				<p>{description}</p>
			</CardContent>
			<CardFooter className="flex flex-row justify-center">
				{button}
			</CardFooter>
		</Card>
	);
}
