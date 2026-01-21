import { ReactNode, VFC } from "react";
import Skeleton, { SkeletonProps } from "@mui/material/Skeleton";
import { styled } from "@mui/material/styles";
import SvgIcon from "@mui/material/SvgIcon";

export enum SkeletonVariantEnum {
  applogo = "applogo",
  text = "text",
  rectangular = "rectangular",
  circular = "circular",
  spinner = "spinner",
}

type VariantStrings = keyof typeof SkeletonVariantEnum;

export interface LoadingProps extends SkeletonProps {
  logotype: VariantStrings;
  logoSrc?: string;
  children?: ReactNode;
}

export const DotsStyleLoading = () => (
  <>
    <circle cx="15" cy="15" r="15">
      <animate
        attributeName="r"
        from="15"
        to="15"
        begin="0s"
        dur="0.8s"
        values="15;9;15"
        calcMode="linear"
        repeatCount="indefinite"
      />
      <animate
        attributeName="fill-opacity"
        from="1"
        to="1"
        begin="0s"
        dur="0.8s"
        values="1;.5;1"
        calcMode="linear"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="60" cy="15" r="9" fillOpacity="0.3">
      <animate
        attributeName="r"
        from="9"
        to="9"
        begin="0s"
        dur="0.8s"
        values="9;15;9"
        calcMode="linear"
        repeatCount="indefinite"
      />
      <animate
        attributeName="fill-opacity"
        from="0.5"
        to="0.5"
        begin="0s"
        dur="0.8s"
        values=".5;1;.5"
        calcMode="linear"
        repeatCount="indefinite"
      />
    </circle>
    <circle cx="105" cy="15" r="15">
      <animate
        attributeName="r"
        from="15"
        to="15"
        begin="0s"
        dur="0.8s"
        values="15;9;15"
        calcMode="linear"
        repeatCount="indefinite"
      />
      <animate
        attributeName="fill-opacity"
        from="1"
        to="1"
        begin="0s"
        dur="0.8s"
        values="1;.5;1"
        calcMode="linear"
        repeatCount="indefinite"
      />
    </circle>
  </>
);

const CircleSpinner = () => (
  <g xmlns="http://www.w3.org/2000/svg" fill="none" fillRule="evenodd">
    <g transform="translate(1 1)" strokeWidth="2">
      <circle cx="5" cy="50" r="5">
        <animate
          attributeName="cy"
          begin="0s"
          dur="2.2s"
          values="50;5;50;50"
          calcMode="linear"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cx"
          begin="0s"
          dur="2.2s"
          values="5;27;49;5"
          calcMode="linear"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="27" cy="5" r="5">
        <animate
          attributeName="cy"
          begin="0s"
          dur="2.2s"
          from="5"
          to="5"
          values="5;50;50;5"
          calcMode="linear"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cx"
          begin="0s"
          dur="2.2s"
          from="27"
          to="27"
          values="27;49;5;27"
          calcMode="linear"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="49" cy="50" r="5">
        <animate
          attributeName="cy"
          begin="0s"
          dur="2.2s"
          values="50;50;5;50"
          calcMode="linear"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cx"
          from="49"
          to="49"
          begin="0s"
          dur="2.2s"
          values="49;5;27;49"
          calcMode="linear"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  </g>
);

const LogoContainer = styled("div")({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "3rem",
  height: "3rem",
  textAlign: "center",
  margin: "auto",
  "& img": {
    width: "100%",
  },
  "& .MuiSvgIcon-root": {
    width: "1.5rem",
    height: "1.5rem",
  },
});

const AppLogoLoading: VFC<Pick<LoadingProps, "logoSrc">> = ({ logoSrc }) => (
  <LogoContainer>
    {logoSrc && <img src={logoSrc} alt="Loading..." />}
    <SvgIcon color="primary" viewBox="0 0 120 30">
      <DotsStyleLoading />
    </SvgIcon>
  </LogoContainer>
);

const SpinnerContainer = styled("div")(({ theme }) => ({
  textAlign: "center",
  margin: "auto",
  "& .MuiSvgIcon-root": {
    width: "4rem",
    height: "4rem",
    stroke: theme.palette.primary.main,
  },
}));
const SpinnerLoading = () => (
  <SpinnerContainer>
    <SvgIcon viewBox="0 0 57 57">
      <CircleSpinner />
    </SvgIcon>
  </SpinnerContainer>
);

const LoadingSkeleton: VFC<Omit<LoadingProps, "variant">> = ({
  logoSrc,
  logotype,
  children,
  ...rest
}) => {
  if (logotype === SkeletonVariantEnum.applogo) {
    return <AppLogoLoading logoSrc={logoSrc} />;
  } else if (logotype === SkeletonVariantEnum.spinner) {
    return <SpinnerLoading />;
  }
  return (
    <Skeleton variant={logotype} {...rest}>
      {children}
    </Skeleton>
  );
};
export default LoadingSkeleton;
