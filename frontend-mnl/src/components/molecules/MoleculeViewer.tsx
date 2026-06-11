"use client";

import { useEffect, useState, useRef } from "react";
import type { MoleculeDetails } from "@/types/api";
import { MOCK_MOLECULES } from "./mockMolecules";

interface MoleculeViewerProps {
  moleculeId?: string | null;
}

// 4. Cache fetched molecule data to avoid repeated API calls
const sdfCache: Record<string, string> = {};

const updateStyle = (style: string, viewer: any, $3DmolMod: any) => {
  if (!viewer) return;
  // 5. For surface mode: remove previous surfaces before adding new one
  viewer.removeAllSurfaces();
  // 5. Ensure styles do NOT stack, use setStyle instead of addStyle
  viewer.setStyle({}, {}); 
  
  if (style === "stick") {
    viewer.setStyle({}, { stick: { radius: 0.15 } });
  } else if (style === "sphere") {
    viewer.setStyle({}, { sphere: {} });
  } else if (style === "surface") {
    viewer.setStyle({}, { stick: { radius: 0.15 } });
    const isDark = typeof document !== "undefined" && (document.documentElement.classList.contains("dark") || document.documentElement.getAttribute("data-theme") === "dark");
    viewer.addSurface($3DmolMod.SurfaceType.VDW, {
      opacity: isDark ? 0.45 : 0.65,
      color: isDark ? '#22d3ee' : '#06b6d4',
    }, {hetflag: false});
  }
  viewer.render();
};

export default function MoleculeViewer({ moleculeId }: MoleculeViewerProps) {
  const [details, setDetails] = useState<MoleculeDetails | null>(null);
  const [contentVisible, setContentVisible] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  
  const [viewStyle, setViewStyle] = useState<"stick" | "sphere" | "surface">("stick");
  const [isLoading3D, setIsLoading3D] = useState(false);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [error3D, setError3D] = useState<string | null>(null);

  useEffect(() => {
    setContentVisible(false);
    const frame = window.requestAnimationFrame(() => setContentVisible(true));

    // Determine target based on ID
    const molecule = MOCK_MOLECULES.find((m) => m.molecule_id === moleculeId);
    
    if (molecule) {
      setIsViewerReady(false);
      setError3D(null);
      setDetails({
        molecule_id: molecule.molecule_id,
        dataset: molecule.dataset,
        structures: {
          smiles: molecule.smiles,
          inchi: "",
          sdf: "", // Ensure this is present
          pdb: "",
        },
        properties: {
          mw: molecule.mw,
          logp: molecule.logp,
          qed: molecule.qed,
          tpsa: 63.60,
          hbd: 1,
          hba: 4,
          rotatable_bonds: 2,
        }
      });
    } else {
      setIsViewerReady(false);
      setError3D(null);
      setDetails(null);
    }

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [moleculeId]);

  useEffect(() => {
    let active = true;
    const structures = details?.structures;

    if (!structures || (!structures.smiles && !structures.sdf)) {
      if (viewerRef.current) viewerRef.current.clear();
      setIsViewerReady(false);
      return;
    }

    const initViewer = async () => {
      try {
        setIsLoading3D(true);
        setIsViewerReady(false);
        setError3D(null);
        
        // @ts-ignore
        const $3DmolMod = (await import("3dmol")).default || (await import("3dmol"));
        
        if (!containerRef.current || !active) return;
        
        const isDark = typeof document !== "undefined" && (document.documentElement.classList.contains("dark") || document.documentElement.getAttribute("data-theme") === "dark");
        const bgColor = isDark ? "#0b0f19" : "white";

        if (!viewerRef.current) {
          viewerRef.current = $3DmolMod.createViewer(containerRef.current, {
            backgroundColor: bgColor,
          });
        } else {
          viewerRef.current.setBackgroundColor(bgColor);
        }
        
        // 2. Prevent memory leaks by clearing previous models and surfaces
        viewerRef.current.clear();

        let sdfData = structures.sdf || "";
        const smiles = structures.smiles;
        
        // 3. If SDF is available, use it first. Otherwise fallback to SMILES.
        if (!sdfData && smiles) {
          if (sdfCache[smiles]) {
            sdfData = sdfCache[smiles];
          } else {
            // Keep PubChem fallback, but optimize it
            const url3d = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/record/SDF/?record_type=3d`;
            let res = await fetch(url3d);
            
            if (res.ok) {
              sdfData = await res.text();
              sdfCache[smiles] = sdfData; // Cache it
            } else {
              // Fallback to 2D
              const res2d = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/record/SDF/?record_type=2d`);
              if (res2d.ok) {
                sdfData = await res2d.text();
                sdfCache[smiles] = sdfData; // Cache it
              } else {
                throw new Error("Molecule structural data not found globally.");
              }
            }
          }
        }

        if (!sdfData) {
          throw new Error("No structure data available to render.");
        }

        if (active && viewerRef.current) {
          viewerRef.current.addModel(sdfData, "sdf");
          
          updateStyle(viewStyle, viewerRef.current, $3DmolMod);
          
          // 6. Automatically fit molecule using zoomTo() after rendering
          viewerRef.current.zoomTo();
          viewerRef.current.render();
          setIsViewerReady(true);
        }
      } catch (err) {
        console.error("3Dmol initialization error", err);
        // 7. Show a minimal error message instead of breaking UI
        if (active) {
          setIsViewerReady(false);
          setError3D("Failed to load 3D structure for this molecule.");
        }
      } finally {
        if (active) setIsLoading3D(false);
      }
    };

    initViewer();

    return () => {
      active = false;
      // 2. Properly clean up the 3Dmol viewer instance on component unmount or molecule change
      if (viewerRef.current) {
        viewerRef.current.clear();
      }
      setIsViewerReady(false);
    };
    // 1. Use the entire structures object as dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details?.structures]);

  // Handle style toggle reactivity
  useEffect(() => {
    if (viewerRef.current) {
      // @ts-ignore
      import("3dmol").then(($3DmolMod) => {
        updateStyle(viewStyle, viewerRef.current, $3DmolMod.default || $3DmolMod);
      });
    }
  }, [viewStyle]);

  // 8. Reset button should re-center and zoom the molecule
  const handleResetView = () => {
    if (viewerRef.current) {
      viewerRef.current.zoomTo();
      viewerRef.current.render();
    }
  };

  if (!details) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <p>Select a molecule to view details</p>
      </div>
    );
  }

  const p = details.properties;
  const isFDA = details.dataset === "FDA Approved";
  const lipinskiPass = (p.mw ?? 0) <= 500 && (p.logp ?? 0) <= 5 && (p.hbd ?? 0) <= 5 && (p.hba ?? 0) <= 10;
  const showViewerLoading = !error3D && (isLoading3D || !isViewerReady);

  return (
    <div
      className={`flex h-full flex-col overflow-y-auto bg-white scrollbar-thin scrollbar-track-slate-50 scrollbar-thumb-slate-200 transition-all duration-200 ease-out dark:bg-[#0b0f19] dark:scrollbar-track-[#0b0f19] dark:scrollbar-thumb-[#1e293b] ${
        contentVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-[#1e293b]">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {details.molecule_id === "MOL-001" ? "Aspirin" : "Molecule"}
          </h2>
          <p className="font-mono text-xs text-slate-500 mt-1 uppercase dark:text-slate-400">
            {details.molecule_id}
          </p>
        </div>
        {isFDA && (
          <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 dark:border-teal-800 dark:bg-[#064e3b] dark:text-teal-400">
            FDA Approved
          </span>
        )}
      </div>

      <div className="flex-1 p-5 space-y-6">
        {/* 3D View */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">3D View</h3>
            <div className="flex items-center gap-2">
              <select 
                value={viewStyle} 
                onChange={(e) => setViewStyle(e.target.value as "stick" | "sphere" | "surface")}
                className="h-7 cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:border-teal-500 focus:outline-none dark:border-[#1e293b] dark:bg-[#0b0f19] dark:text-slate-300"
              >
                <option value="stick">Stick</option>
                <option value="sphere">Sphere</option>
                <option value="surface">Surface</option>
              </select>
              <button 
                onClick={handleResetView}
                className="h-7 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-[#1e293b] dark:bg-[#0b0f19] dark:text-slate-300 dark:hover:bg-[#1e293b]"
              >
                Reset
              </button>
            </div>
          </div>
          
          <div className="rounded-lg border border-slate-200 bg-white relative h-64 overflow-hidden shadow-inner dark:border-[#1e293b]">
            {error3D ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 px-4 text-center dark:bg-[#0b0f19]/90">
                <svg className="h-6 w-6 text-rose-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{error3D}</p>
              </div>
            ) : showViewerLoading ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 dark:bg-[#0b0f19]/80">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-teal-500 dark:border-slate-700 dark:border-t-teal-500"></div>
              </div>
            ) : null}
            
            <div
              ref={containerRef}
              className={`absolute inset-0 z-10 h-full w-full transition-opacity duration-200 ${
                isViewerReady ? "opacity-100" : "opacity-0"
              }`}
            />
            <span className="pointer-events-none absolute bottom-3 right-3 z-30 text-[10px] font-semibold tracking-widest text-slate-400 uppercase drop-shadow-md">
              Powered by 3Dmol
            </span>
          </div>
        </div>

        {/* SMILES */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">SMILES</h3>
          <p className="font-mono text-sm break-all text-slate-700 dark:text-slate-300">{details.structures.smiles}</p>
        </div>

        {/* Properties */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">Properties</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-[#1e293b]">
              <p className="text-xs text-slate-500 dark:text-slate-400">Molecular Weight</p>
              <p className="mt-1 font-mono text-lg font-semibold text-teal-600 dark:text-teal-400">
                {p.mw.toFixed(2)} <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Da</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-[#1e293b]">
              <p className="text-xs text-slate-500 dark:text-slate-400">LogP</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-slate-100">
                {p.logp.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-[#1e293b]">
              <p className="text-xs text-slate-500 dark:text-slate-400">TPSA</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-slate-100">
                {p.tpsa.toFixed(2)} <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Å²</span>
              </p>
            </div>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 dark:border-teal-900/50 dark:bg-[#064e3b]/10">
              <p className="text-xs text-teal-700 dark:text-slate-400">QED</p>
              <p className="mt-1 font-mono text-lg font-semibold text-teal-600 dark:text-teal-400">
                {p.qed.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-[#1e293b]">
              <p className="text-xs text-slate-500 dark:text-slate-400">H-Bond Donors</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-slate-100">{p.hbd.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-[#1e293b]">
              <p className="text-xs text-slate-500 dark:text-slate-400">H-Bond Acceptors</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-slate-100">{p.hba.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Lipinski Rule of 5 */}
        <div className="space-y-3 pt-2 block">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">Lipinski Rule of 5</h3>
          <div className="space-y-2">
            {[
              { rule: "MW ≤ 500", pass: (p.mw ?? 0) <= 500 },
              { rule: "LogP ≤ 5", pass: (p.logp ?? 0) <= 5 },
              { rule: "HBD ≤ 5", pass: (p.hbd ?? 0) <= 5 },
              { rule: "HBA ≤ 10", pass: (p.hba ?? 0) <= 10 },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-mono text-slate-600 dark:text-slate-400">{item.rule}</span>
                {item.pass ? (
                  <span className="rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs text-teal-700 dark:border-teal-800 dark:bg-[#064e3b] dark:text-teal-400">Pass</span>
                ) : (
                  <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700 dark:border-rose-800 dark:bg-[#4c0519] dark:text-rose-400">Fail</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
