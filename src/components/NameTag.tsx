export default function NameTag({ tag }: { tag?: string | null }) {
  return tag ? <img className="tag" src={tag} alt="" /> : null;
}
