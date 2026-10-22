// Estado de carga: el canto del velo (帳) que bajan los hechiceros antes de entrar.
export default function VeilLoading({ label = 'Bajando el velo…' }) {
  return (
    <div className="veil" role="status" aria-live="polite">
      <p className="veil__chant" lang="ja">
        闇より出でて闇より黒く
        <br />
        その穢れを禊ぎ祓え
      </p>
      <p className="veil__es">Nacido de la oscuridad, más negro que la oscuridad. Purificá esta impureza.</p>
      <p className="veil__label">{label}</p>
    </div>
  );
}
