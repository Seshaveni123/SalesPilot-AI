from pathlib import Path

from app.config import PROJECT_ROOT, Settings


def test_relative_paths_resolve_to_project_root_regardless_of_cwd(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    s = Settings(
        gemini_api_key="test_dummy_key_value",
        database_url="sqlite:///./backend/salespilot.db",
        faiss_index_path="./backend/data/faiss_index",
        knowledge_base_dir="./knowledge_base",
    )
    assert s.is_gemini_configured is True
    assert Path(s.knowledge_base_dir) == (PROJECT_ROOT / "knowledge_base").resolve()
    assert Path(s.faiss_index_path) == (PROJECT_ROOT / "backend" / "data" / "faiss_index").resolve()
    expected_db = (PROJECT_ROOT / "backend" / "salespilot.db").resolve().as_posix()
    assert s.database_url == f"sqlite:///{expected_db}"


def test_quoted_and_placeholder_gemini_keys_handled_properly():
    quoted = Settings(gemini_api_key='  "sample_test_key_123"  ')
    assert quoted.gemini_api_key == "sample_test_key_123"
    assert quoted.is_gemini_configured is True

    placeholder = Settings(gemini_api_key="your_gemini_api_key_here")
    assert placeholder.is_gemini_configured is False
