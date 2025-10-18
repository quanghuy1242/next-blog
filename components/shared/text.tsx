interface TextProps {
  text: string;
}

export function Text({ text }: TextProps) {
  return <h3 className="font-bold text-blue leading-8">{text}</h3>;
}
