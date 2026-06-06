
import openmm as mm
from openmm import app, unit
from pdbfixer import PDBFixer

def run_openmm_complex(protein_pdb, ligand_sdf):
    # 1. Parameterize ligand with Antechamber/GAFF2
    #    Requires subprocess call: antechamber -i ligand.sdf -fi sdf -o ligand.mol2 -fo mol2 -c bcc -s 2
    #    parmchk2 -i ligand.mol2 -f mol2 -o ligand.frcmod
    
    # 2. Setup protein with PDBFixer
    fixer = PDBFixer(filename=protein_pdb)
    fixer.findMissingResidues()
    fixer.findMissingAtoms()
    fixer.addMissingAtoms()
    fixer.addMissingHydrogens(7.4)
    
    # 3. Create Forcefield
    comp_ff = app.ForceField('amber14-all.xml', 'amber14/tip3pfb.xml', 'ligand.xml')
    
    # 4. Solvate complex
    modeller = app.Modeller(fixer.topology, fixer.positions)
    # modeller.add(ligand_topology, ligand_positions)
    modeller.addSolvent(comp_ff, padding=1.0*unit.nanometers, ionicStrength=0.15*unit.molar)
    
    # 5. Build System
    system = comp_ff.createSystem(modeller.topology, nonbondedMethod=app.PME, 
                                  nonbondedCutoff=1.0*unit.nanometers, constraints=app.HBonds)
    system.addForce(mm.MonteCarloBarostat(1*unit.atmospheres, 310*unit.kelvin))
    
    # 6. Integrate & Run
    integrator = mm.LangevinMiddleIntegrator(310*unit.kelvin, 1/unit.picosecond, 0.002*unit.picoseconds)
    simulation = app.Simulation(modeller.topology, system, integrator)
    simulation.context.setPositions(modeller.positions)
    
    # Minimize
    simulation.minimizeEnergy(maxIterations=1000)
    
    # Production Run (100 ns = 50,000,000 steps)
    simulation.reporters.append(app.DCDReporter('trajectory.dcd', 5000))
    simulation.reporters.append(app.StateDataReporter('md_log.txt', 5000, step=True, 
                                potentialEnergy=True, temperature=True))
    simulation.step(50000000)
