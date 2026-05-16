cmake_minimum_required(VERSION 3.20)

project(QAIDrugResearch LANGUAGES NONE)

find_package(Python3 REQUIRED COMPONENTS Interpreter)

set(QAI_CONFIG "configs/cancer_targets.yaml" CACHE STRING "Pipeline configuration YAML.")
set(QAI_OUTPUT "outputs/cancer_proof_v1" CACHE STRING "Pipeline output directory.")
set(QAI_MAX_RECORDS_PER_TARGET "1000" CACHE STRING "Maximum public activity records to retrieve per target.")
set(QAI_N_GENERATE "" CACHE STRING "Optional generated molecule count per target. Empty uses config default.")
set(QAI_GNINA_TOP_PER_TARGET "1" CACHE STRING "Top candidates per target to send through GNINA CNN docking.")
set(QAI_GNINA_DEPTH_MODE "quick" CACHE STRING "GNINA depth mode: quick, investor, scientific, or custom.")
option(QAI_SKIP_DOWNLOAD "Skip public dataset download during run_research." OFF)
option(QAI_FORCE_REFRESH "Force refresh public dataset downloads." OFF)
option(QAI_INCLUDE_BINDINGDB "Include BindingDB retrieval in download_data." OFF)

set(QAI_RUN_ARGS
    run-cancer-proof
    --config ${QAI_CONFIG}
    --out ${QAI_OUTPUT}
    --max-records-per-target ${QAI_MAX_RECORDS_PER_TARGET}
)

if(QAI_SKIP_DOWNLOAD)
  list(APPEND QAI_RUN_ARGS --skip-download)
endif()

if(QAI_FORCE_REFRESH)
  list(APPEND QAI_RUN_ARGS --force-refresh)
endif()

if(NOT "${QAI_N_GENERATE}" STREQUAL "")
  list(APPEND QAI_RUN_ARGS --n-generate ${QAI_N_GENERATE})
endif()

set(QAI_DOWNLOAD_ARGS
    download-data
    --config ${QAI_CONFIG}
    --max-records-per-target ${QAI_MAX_RECORDS_PER_TARGET}
)

if(QAI_INCLUDE_BINDINGDB)
  list(APPEND QAI_DOWNLOAD_ARGS --include-bindingdb)
endif()

if(QAI_FORCE_REFRESH)
  list(APPEND QAI_DOWNLOAD_ARGS --force-refresh)
endif()

add_custom_target(setup_python
  COMMAND ${Python3_EXECUTABLE} -m pip install -e ".[research]"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Installing the Q-AI research package and Python research extras."
)

if(WIN32)
  add_custom_target(install_wsl_tools
    COMMAND powershell -NoProfile -ExecutionPolicy Bypass -File "${CMAKE_SOURCE_DIR}/scripts/setup_wsl_tools.ps1"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    VERBATIM
    COMMENT "Installing or repairing Vina, Smina, GNINA, OpenBabel, and xTB inside WSL."
  )
else()
  add_custom_target(install_wsl_tools
    COMMAND bash "${CMAKE_SOURCE_DIR}/scripts/setup_wsl_tools.sh"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    VERBATIM
    COMMENT "Installing or repairing Vina, Smina, GNINA, OpenBabel, and xTB."
  )
endif()

add_custom_target(verify_tools
  COMMAND ${Python3_EXECUTABLE} "${CMAKE_SOURCE_DIR}/scripts/verify_external_tools.py"
          --strict
          --output "${CMAKE_SOURCE_DIR}/outputs/external_tools_manifest.json"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Verifying external tool discovery through Windows PATH and WSL."
)
add_dependencies(verify_tools setup_python install_wsl_tools)

add_custom_target(smoke_tools
  COMMAND ${Python3_EXECUTABLE} "${CMAKE_SOURCE_DIR}/scripts/smoke_external_tools.py"
          --output "${CMAKE_SOURCE_DIR}/outputs/tool_smoke/external_tool_smoke.json"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Running real smoke checks for OpenBabel, xTB, AutoDock Vina, Smina, and GNINA."
)
add_dependencies(smoke_tools verify_tools)

add_custom_target(setup_all
  DEPENDS smoke_tools
  COMMENT "Complete local setup: Python package, tool discovery, and external tool smoke tests."
)

add_custom_target(download_data
  COMMAND ${Python3_EXECUTABLE} -m q_ai_drug.cli ${QAI_DOWNLOAD_ARGS}
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Downloading and caching public oncology datasets and structures."
)
add_dependencies(download_data setup_python)

add_custom_target(curate_legacy_structures
  COMMAND ${Python3_EXECUTABLE} "${CMAKE_SOURCE_DIR}/scripts/curate_legacy_structures.py"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Copying legacy ADA/ALDR/CAH2/TRY1/TRYB1 AlphaFold receptors into data/structures_havetosee."
)
add_dependencies(curate_legacy_structures setup_python)

add_custom_target(train_models
  COMMAND ${Python3_EXECUTABLE} "${CMAKE_SOURCE_DIR}/scripts/train_research_models.py"
          --config "${QAI_CONFIG}"
          --out "${QAI_OUTPUT}"
          --max-records-per-target ${QAI_MAX_RECORDS_PER_TARGET}
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Downloading datasets if needed and training reusable activity plus ADMET models into models/."
)
add_dependencies(train_models download_data curate_legacy_structures)

add_custom_target(run_research
  COMMAND ${Python3_EXECUTABLE} -m q_ai_drug.cli ${QAI_RUN_ARGS}
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Running the full cancer drug discovery research pipeline."
)
add_dependencies(run_research smoke_tools)

add_custom_target(run_gnina
  COMMAND ${Python3_EXECUTABLE} -m q_ai_drug.docking.gnina_runner
          --candidates "${QAI_OUTPUT}/top_candidates.csv"
          --assets "${QAI_OUTPUT}/assets/ligand_asset_manifest.csv"
          --structures "data/structures"
          --out "${QAI_OUTPUT}/gnina"
          --top-per-target ${QAI_GNINA_TOP_PER_TARGET}
          --depth-mode ${QAI_GNINA_DEPTH_MODE}
          --exhaustiveness 1
          --num-modes 3
          --cpu 4
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Running real GNINA CPU CNN docking/rescoring for top candidates."
)
add_dependencies(run_gnina verify_tools)

add_custom_target(run_gnina_after_research
  COMMAND ${Python3_EXECUTABLE} -m q_ai_drug.docking.gnina_runner
          --candidates "${QAI_OUTPUT}/top_candidates.csv"
          --assets "${QAI_OUTPUT}/assets/ligand_asset_manifest.csv"
          --structures "data/structures"
          --out "${QAI_OUTPUT}/gnina"
          --top-per-target ${QAI_GNINA_TOP_PER_TARGET}
          --depth-mode ${QAI_GNINA_DEPTH_MODE}
          --exhaustiveness 1
          --num-modes 3
          --cpu 4
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Running real GNINA CPU CNN docking/rescoring after the research pipeline."
)
add_dependencies(run_gnina_after_research run_research)

add_custom_target(redocking_validation
  COMMAND ${Python3_EXECUTABLE} -m q_ai_drug.docking.redocking_validation
          --project "${QAI_OUTPUT}"
          --pockets "configs/oncology_pockets.yaml"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Writing target pocket and redocking validation status evidence."
)
add_dependencies(redocking_validation setup_python)

add_custom_target(run_experiments
  COMMAND ${Python3_EXECUTABLE} -m q_ai_drug.experiments.research_experiments
          --project "${QAI_OUTPUT}"
          --n-experiments 144
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Running 100+ in silico research stress tests and hybrid consensus ranking."
)
add_dependencies(run_experiments run_gnina_after_research redocking_validation)

add_custom_target(harden_scientific_study
  COMMAND ${Python3_EXECUTABLE} -m q_ai_drug.research.scientific_study
          --project "${QAI_OUTPUT}"
          --config "${QAI_CONFIG}"
          --benchmark "data/processed/oncology_benchmark.csv"
          --references "data/processed/reference_inhibitors.csv"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Building strict scientific curation, baseline, applicability-domain, ablation, and candidate-dossier artifacts."
)
add_dependencies(harden_scientific_study run_experiments)

add_custom_target(build_report
  COMMAND ${Python3_EXECUTABLE} -m q_ai_drug.reporting.build_report
          --project "${QAI_OUTPUT}"
          --config "${QAI_CONFIG}"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Rebuilding the HTML/PDF research report from pipeline artifacts."
)
add_dependencies(build_report harden_scientific_study)

add_custom_target(validate_artifacts
  COMMAND ${Python3_EXECUTABLE} "${CMAKE_SOURCE_DIR}/scripts/validate_research_artifacts.py"
          --project "${QAI_OUTPUT}"
          --tier proof
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Validating generated research artifacts, figures, model outputs, and tool evidence."
)
add_dependencies(validate_artifacts build_report)

add_custom_target(validate_production
  COMMAND ${Python3_EXECUTABLE} "${CMAKE_SOURCE_DIR}/scripts/validate_research_artifacts.py"
          --project "${QAI_OUTPUT}"
          --tier production
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Running production-tier validation gates, including real docking and MD requirements."
)
add_dependencies(validate_production build_report)

add_custom_target(build_completion_report
  COMMAND ${Python3_EXECUTABLE} -m q_ai_drug.reporting.completion_report
          --project "${QAI_OUTPUT}"
          --markdown-out "${CMAKE_SOURCE_DIR}/docs/project_completion_report.md"
          --html-out "${QAI_OUTPUT}/project_completion_report.html"
          --json-out "${QAI_OUTPUT}/product_readiness_report.json"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Building the investor/product completion report and readiness JSON."
)
add_dependencies(build_completion_report validate_production)

add_custom_target(unit_tests
  COMMAND ${Python3_EXECUTABLE} -m pytest tests -q
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Running Python unit tests."
)
add_dependencies(unit_tests setup_python)

add_custom_target(smoke_ui_api
  COMMAND ${Python3_EXECUTABLE} "${CMAKE_SOURCE_DIR}/scripts/smoke_ui_api.py"
          --base-url "http://127.0.0.1:8000"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  VERBATIM
  COMMENT "Smoke-checking dashboard, investor site, and research API endpoints on the active local server."
)
add_dependencies(smoke_ui_api setup_python)

add_custom_target(test_all
  DEPENDS unit_tests validate_artifacts
  COMMENT "Running unit tests plus proof-tier artifact validation."
)

add_custom_target(research_all
  DEPENDS validate_artifacts
  COMMENT "One target that sets up tools, runs the research pipeline, rebuilds the report, and validates artifacts."
)

add_custom_target(investor_package
  DEPENDS unit_tests build_completion_report
  COMMENT "Building the investor-ready package: tests, production validation, completion report, and readiness JSON."
)

if(WIN32)
  add_custom_target(serve_report
    COMMAND powershell -NoProfile -ExecutionPolicy Bypass -File "${CMAKE_SOURCE_DIR}/scripts/serve_report.ps1"
            -ProjectDir "${QAI_OUTPUT}"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    VERBATIM
    COMMENT "Serving and opening the generated research report."
  )

  add_custom_target(serve_api
    COMMAND powershell -NoProfile -ExecutionPolicy Bypass -File "${CMAKE_SOURCE_DIR}/scripts/serve_api.ps1"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    VERBATIM
    COMMENT "Starting the FastAPI research service."
  )

  add_custom_target(serve_dashboard
    COMMAND powershell -NoProfile -ExecutionPolicy Bypass -File "${CMAKE_SOURCE_DIR}/scripts/serve_api.ps1"
            -OpenPath "/dashboard"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    VERBATIM
    COMMENT "Starting the research dashboard frontend."
  )

  add_custom_target(serve_investor
    COMMAND powershell -NoProfile -ExecutionPolicy Bypass -File "${CMAKE_SOURCE_DIR}/scripts/serve_api.ps1"
            -OpenPath "/investor"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    VERBATIM
    COMMENT "Starting the investor website and API service."
  )
else()
  add_custom_target(serve_report
    COMMAND ${Python3_EXECUTABLE} -m http.server 8010 --bind 127.0.0.1
    WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}/${QAI_OUTPUT}"
    VERBATIM
    COMMENT "Serving the generated research report at http://127.0.0.1:8010/report.html."
  )

  add_custom_target(serve_api
    COMMAND ${Python3_EXECUTABLE} -m uvicorn q_ai_drug.service.api:app --host 127.0.0.1 --port 8000
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    VERBATIM
    COMMENT "Starting the FastAPI research service at http://127.0.0.1:8000/docs."
  )

  add_custom_target(serve_dashboard
    COMMAND ${Python3_EXECUTABLE} -m uvicorn q_ai_drug.service.api:app --host 127.0.0.1 --port 8000
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    VERBATIM
    COMMENT "Starting the research dashboard frontend at http://127.0.0.1:8000/dashboard."
  )

  add_custom_target(serve_investor
    COMMAND ${Python3_EXECUTABLE} -m uvicorn q_ai_drug.service.api:app --host 127.0.0.1 --port 8000
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    VERBATIM
    COMMENT "Starting the investor website at http://127.0.0.1:8000/investor."
  )
endif()
add_dependencies(serve_api setup_python)
add_dependencies(serve_dashboard setup_python)
add_dependencies(serve_investor setup_python build_completion_report)

if(WIN32)
  add_custom_target(show_project
    COMMAND powershell -NoProfile -ExecutionPolicy Bypass -File "${CMAKE_SOURCE_DIR}/scripts/serve_report.ps1"
            -ProjectDir "${QAI_OUTPUT}"
    COMMAND powershell -NoProfile -ExecutionPolicy Bypass -File "${CMAKE_SOURCE_DIR}/scripts/serve_api.ps1"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    VERBATIM
    COMMENT "Running the pipeline, then starting the report and API servers."
  )
else()
  add_custom_target(show_project
    COMMAND ${CMAKE_COMMAND} -E echo "Report: ${CMAKE_SOURCE_DIR}/${QAI_OUTPUT}/report.html"
    COMMAND ${CMAKE_COMMAND} -E echo "Run 'cmake --build --preset serve-report' or 'cmake --build --preset serve-api' in another shell to serve locally."
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    VERBATIM
    COMMENT "Running the pipeline and showing local report paths."
  )
endif()
add_dependencies(show_project research_all)
