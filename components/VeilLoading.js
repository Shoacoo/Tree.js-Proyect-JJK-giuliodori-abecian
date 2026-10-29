// Estado de carga: el canto del velo que bajan los hechiceros antes de entrar.
export default function VeilLoading({ label = 'Bajando el velo…' }) {
  return (
    <div className="veil" role="status" aria-live="polite">
      <p className="eyebrow">CustodiaOS · cargando</p>
      <p className="veil__chant">Nacido de la oscuridad, más negro que la oscuridad. Purificá esta impureza.</p>
      <p className="veil__label">
        {label} <span className="cursor" aria-hidden="true" />
      </p>
    </div>
  );
}
