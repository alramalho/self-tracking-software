import Lottie from "react-lottie";
import rocketAnimation from "../../public/animations/rocket.lottie.json";

export const RocketAnimation = (props: {
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
            animationData: rocketAnimation,
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