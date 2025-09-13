import Lottie from "react-lottie";
import seedAnimation from "../../public/animations/seed.lottie.json";

export const SeedAnimation = (props: {
    height: number;
    width: number;
    className?: string;
  }) => {
    return (
      <div className={props.className}>
        <Lottie
          options={{
            loop: true,
            autoplay: true,
            animationData: seedAnimation,
            rendererSettings: {
              preserveAspectRatio: "xMidYMid slice",
            },
          }}
          height={props.height || 60}
          width={props.width || 60}
        />
      </div>
    );
  };