// Page bodlanor shathe shathe ei halka kankal dekhay — data ashle ashol page boshe (shada screen e atke thake na)
export default function Loading() {
  return (
    <div className="adm-skel" aria-busy="true" aria-label="লোড হচ্ছে">
      <div className="skel skel-title" />
      <div className="skel-row">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel skel-card" />)}
      </div>
      <div className="skel skel-block" />
      <div className="skel skel-block short" />
    </div>
  );
}
